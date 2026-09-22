import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 14A seeds Admin read permissions and enforces platform-only Admin routes', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);

  async function identity(roleName: 'CUSTOMER' | 'DISPATCHER' | 'HOME_CLEAN_ADMIN', companyId?: string) {
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await db.user.create({
      data: {
        phone: `+14${randomUUID().replaceAll('-', '').slice(0, 12)}`,
        name: `${roleName} foundation test`,
        roles: { create: { roleId: role.id, companyId } },
      },
    });
    const token = randomBytes(32).toString('base64url');
    await db.session.create({
      data: {
        userId: user.id,
        accessTokenHash: sessionHash(token),
        refreshTokenHash: sessionHash(randomBytes(32).toString('base64url')),
        accessExpiresAt: new Date(Date.now() + 60_000),
        expiresAt: new Date(Date.now() + 120_000),
      },
    });
    return { role, user, token };
  }

  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const get = (path: string, token?: string) => fetch(`${base}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });

    const expected = [
      'admin:dashboard:read',
      'identity:read',
      'payment:read',
      'refund:read',
      'cash:read',
      'settlement:read',
      'notification:operations:read',
    ];
    const adminRole = await db.role.findUniqueOrThrow({
      where: { name: 'HOME_CLEAN_ADMIN' },
      include: { permissions: { include: { permission: true } } },
    });
    const granted = new Set(adminRole.permissions.map((row: any) => row.permission.code));
    for (const permission of expected) assert.equal(granted.has(permission), true, `${permission} must be seeded`);

    const admin = await identity('HOME_CLEAN_ADMIN');
    const adminResponse = await get('/admin/services', admin.token);
    assert.equal(adminResponse.status, 200);
    const me = await (await get('/auth/me', admin.token)).json() as any;
    assert.equal(me.data.scopes.length, 1);
    assert.equal(me.data.scopes[0].role, 'HOME_CLEAN_ADMIN');
    for (const permission of expected) assert.equal(me.data.scopes[0].permissions.includes(permission), true);

    assert.equal((await get('/admin/services')).status, 401);
    const customer = await identity('CUSTOMER');
    assert.equal((await get('/admin/services', customer.token)).status, 403);

    // Even a deliberately misconfigured permission grant cannot turn a Dispatcher into a platform Admin.
    const dispatcherRole = await db.role.findUniqueOrThrow({ where: { name: 'DISPATCHER' } });
    const servicePermission = await db.permission.findUniqueOrThrow({ where: { code: 'service:manage' } });
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: dispatcherRole.id, permissionId: servicePermission.id } },
      create: { roleId: dispatcherRole.id, permissionId: servicePermission.id },
      update: {},
    });
    const dispatcher = await identity('DISPATCHER');
    assert.equal((await get('/admin/services', dispatcher.token)).status, 403);

    // A platform role with provider scope is invalid and is filtered out by the live grant boundary.
    const company = await db.company.create({
      data: { internalCode: `P14A-${randomUUID().slice(0, 8)}`.toUpperCase(), name: 'Scoped admin test', status: 'ACTIVE', commissionRate: '0.20' },
    });
    const scopedAdmin = await identity('HOME_CLEAN_ADMIN', company.id);
    assert.equal((await get('/admin/services', scopedAdmin.token)).status, 403);
  } finally {
    await app.close();
  }
});
