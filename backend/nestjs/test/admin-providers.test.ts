import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 14D Admin providers, teams, catalog and pricing use safe projections, filters and audited commands', async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp(); const db = app.get(PrismaService);
  async function identity(roleName: 'HOME_CLEAN_ADMIN' | 'DISPATCHER', name: string) {
    const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await db.user.create({ data: { phone: `+18${randomUUID().replaceAll('-', '').slice(0, 12)}`, name, roles: { create: { roleId: role.id } } } });
    const token = randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('base64url')), accessExpiresAt: new Date(Date.now() + 600_000), expiresAt: new Date(Date.now() + 1_200_000) } });
    return { user, token };
  }
  try {
    await app.listen(0, '127.0.0.1'); const base = `${await app.getUrl()}/api/v1`;
    async function request(method: string, path: string, token: string, body?: unknown, key?: string) {
      const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() as any };
    }
    const admin = await identity('HOME_CLEAN_ADMIN', '14D Admin'); const dispatcher = await identity('DISPATCHER', '14D Dispatcher');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const company = (await request('POST', '/admin/companies', admin.token, { internalCode: `D14-${suffix}`, name: '14D Provider', status: 'ACTIVE', commissionRate: '0.1500' })).body.data;
    const service = (await request('POST', '/admin/services', admin.token, { code: `D14_SERVICE_${suffix}`, name: '14D Service', nameAr: 'خدمة 14D', description: 'Phase 14D fixture', basePrice: '25.00', durationMinutes: 90, active: true })).body.data;
    const team = (await request('POST', '/provider/teams', admin.token, { companyId: company.id, internalCode: `D14-T-${suffix}`, name: '14D Team', capacity: 2 })).body.data;

    const companyList = await request('GET', `/admin/companies?status=ACTIVE&query=${encodeURIComponent('14D Provider')}&limit=10&offset=0`, admin.token);
    assert.equal(companyList.status, 200); assert.equal(companyList.body.data[0].id, company.id); assert.equal('commissionRate' in companyList.body.data[0], true);
    const detail = await request('GET', `/admin/companies/${company.id}`, admin.token);
    assert.equal(detail.status, 200); assert.deepEqual(detail.body.data.counts, { teams: 1, activeTeams: 1, activeManagers: 0, openAssignments: 0, unsettledPayables: 0 }); assert.equal(detail.body.data.serviceAreas.length, 0);
    assert.equal((await request('GET', `/admin/companies/${company.id}`, dispatcher.token)).status, 403);

    const area = await request('POST', `/admin/companies/${company.id}/service-areas`, admin.token, { name: 'Amman', latitude: 31.95, longitude: 35.91, radiusKm: '10.000', active: true });
    assert.equal(area.status, 201);
    const teamList = await request('GET', `/provider/teams?companyId=${company.id}&status=OFFLINE&active=true&query=14D&limit=10&offset=0`, admin.token);
    assert.equal(teamList.status, 200); assert.equal(teamList.body.data[0].id, team.id);
    assert.equal((await request('GET', `/provider/teams?active=not-a-boolean`, admin.token)).status, 400);
    const safeProviderDetail = await request('GET', `/provider/teams/${team.id}`, dispatcher.token);
    assert.equal(safeProviderDetail.status, 200); assert.equal('commissionRate' in safeProviderDetail.body.data, false); assert.equal(safeProviderDetail.body.data.company.id, company.id);

    const provision = await request('POST', '/admin/users', admin.token, { phone: '+962790000001', name: '14D Manager', role: 'COMPANY_MANAGER', companyId: company.id });
    assert.equal(provision.status, 201);
    const memberProvision = await request('POST', '/admin/users', admin.token, { phone: '+962780000001', name: '14D Cleaner', role: 'TEAM_LEADER_CLEANER', companyId: company.id, teamId: team.id });
    assert.equal(memberProvision.status, 201);
    const members = await request('GET', `/provider/teams/${team.id}/members?limit=10&offset=0`, admin.token); assert.equal(members.body.data.length, 1);
    const detailAfter = await request('GET', `/admin/companies/${company.id}`, admin.token); assert.equal(detailAfter.body.data.counts.activeManagers, 1);

    const extra = await request('POST', `/admin/services/${service.id}/extras`, admin.token, { code: `D14_EXTRA_${suffix}`, name: 'Extra', nameAr: 'إضافة', price: '5.00', active: true }); assert.equal(extra.status, 201);
    const extras = await request('GET', `/admin/services/${service.id}/extras?limit=10&offset=0`, admin.token); assert.equal(extras.body.data.length, 1);
    const ruleBody = { name: `D14_RULE_${suffix}`, version: 1, definition: { kind: 'FEE', basis: 'FIXED', amount: '2.00', serviceId: service.id }, active: true, startsAt: '2026-01-01T00:00:00Z', endsAt: '2027-01-01T00:00:00Z' };
    const rule = await request('POST', '/admin/pricing/rules', admin.token, ruleBody, `d14-rule-${suffix}`); assert.equal(rule.status, 201);
    const replay = await request('POST', '/admin/pricing/rules', admin.token, ruleBody, `d14-rule-${suffix}`); assert.equal(replay.status, 201); assert.equal(replay.body.data.id, rule.body.data.id);
    const promotion = await request('POST', '/admin/promotions', admin.token, { code: `D14_${suffix}`, discount: '3.00', minTotal: '10.00', active: false, startsAt: '2026-01-01T00:00:00Z', endsAt: '2027-01-01T00:00:00Z' }, `d14-promo-${suffix}`); assert.equal(promotion.status, 201);
    assert.equal((await request('POST', `/admin/promotions/${promotion.body.data.id}/activation`, admin.token, { active: true }, `d14-promo-active-${suffix}`)).status, 200);
    assert.equal(await db.auditLog.count({ where: { actorUserId: admin.user.id, action: { in: ['COMPANY_CREATED', 'SERVICE_CREATED', 'TEAM_CREATED', 'SERVICE_AREA_CREATED', 'IDENTITY_PROVISIONED', 'PRICING_RULE_PUBLISHED', 'PROMOTION_PUBLISHED'] } } }), 8);
  } finally { await app.close(); }
});
