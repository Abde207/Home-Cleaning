import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('customer ownership, provider isolation, admin permissions and audit transactions', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function identity(roleName: string, companyId?: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
      const user = await db.user.create({ data: { phone: `+test-${randomUUID()}`.slice(0, 20), customer: { create: {} }, roles: { create: { roleId: role.id, companyId } } } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 120000) } });
      return token;
    }
    async function tokenFor(userId: string) {
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 120000) } });
      return token;
    }
    async function request(method: string, path: string, token: string, body?: unknown) {
      const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() as any };
    }
    const customer = await identity('CUSTOMER');
    const other = await identity('CUSTOMER');
    const admin = await identity('HOME_CLEAN_ADMIN');
    const dispatcher = await identity('DISPATCHER');
    const addressDto = { label: 'Home', addressText: 'Amman', latitude: 31.95, longitude: 35.91 };
    const address = await request('POST', '/customers/me/addresses', customer, addressDto);
    assert.equal(address.status, 201);
    assert.equal((await request('GET', '/customers/me/addresses', other)).body.data.length, 0);
    assert.equal((await request('PUT', `/customers/me/addresses/${address.body.data.id}`, other, addressDto)).status, 404);
    assert.equal((await request('DELETE', `/customers/me/addresses/${address.body.data.id}`, other)).status, 404);
    assert.equal((await request('POST', '/customers/me/addresses', customer, { ...addressDto, customerId: randomUUID() })).status, 400);
    assert.equal((await request('POST', '/customers/me/properties', customer, { type: 'APARTMENT', size: '0', rooms: 1, bathrooms: 1 })).status, 400);
    assert.equal((await request('GET', '/admin/services', dispatcher)).status, 403);
    assert.equal((await request('GET', '/admin/companies', customer)).status, 403);
    const dto = { code: 'TEST_SERVICE', name: 'Test', nameAr: 'اختبار', description: '', basePrice: '12.50', durationMinutes: 60, active: true };
    const service = await request('POST', '/admin/services', admin, dto);
    assert.equal(service.status, 201);
    assert.equal((await request('POST', '/admin/services', admin, { ...dto, code: 'BAD', basePrice: 12.50 })).status, 400);
    assert.equal((await request('POST', '/admin/services', admin, dto)).status, 409);
    assert.equal(await db.auditLog.count({ where: { action: 'SERVICE_CREATED', resourceId: service.body.data.id } }), 1);
    const publicServices = await (await fetch(`${base}/services`)).json() as any;
    assert.equal(publicServices.data.some((s: any) => s.code === 'REGULAR_CLEANING'), false);
    assert.equal(publicServices.data.find((s: any) => s.id === service.body.data.id).basePrice, '12.5');
    const company = await request('POST', '/admin/companies', admin, { internalCode: 'TEST-COMPANY', name: 'Test', status: 'ACTIVE', commissionRate: '0.20' });
    assert.equal(company.status, 201);
    const manager = await identity('COMPANY_MANAGER', company.body.data.id);
    const teamDto = { companyId: company.body.data.id, internalCode: 'TEST-TEAM', name: 'Team', capacity: 3 };
    const team = await request('POST', '/provider/teams', manager, teamDto);
    assert.equal(team.status, 201);
    assert.equal((await request('POST', '/provider/teams', manager, { ...teamDto, companyId: randomUUID(), internalCode: 'OTHER-TEAM' })).status, 403);
    assert.equal((await request('GET', '/provider/teams', customer)).status, 403);
    assert.equal((await request('GET', '/provider/teams', manager)).body.data.length, 1);
    assert.equal((await request('GET', '/provider/teams?limit=1&offset=1', manager)).body.data.length, 0);
    assert.equal((await request('GET', '/provider/teams?limit=101', manager)).status, 400);
    assert.equal((await request('POST', `/provider/teams/${team.body.data.id}/availability`, manager, { startsAt: '2027-01-01T12:00:00Z', endsAt: '2027-01-01T11:00:00Z', available: true })).status, 400);

    const companyId = company.body.data.id, teamId = team.body.data.id, serviceId = service.body.data.id;
    const secondCompanyDto = { internalCode: 'SECOND-COMPANY', name: 'Second', status: 'ACTIVE', commissionRate: '0.20' };
    const secondCompany = await request('POST', '/admin/companies', admin, secondCompanyDto);
    assert.equal(secondCompany.status, 201);
    const secondManager = await identity('COMPANY_MANAGER', secondCompany.body.data.id);
    const secondTeam = await request('POST', '/provider/teams', secondManager, { ...teamDto, companyId: secondCompany.body.data.id, internalCode: 'SECOND-TEAM' });
    assert.equal(secondTeam.status, 201);
    assert.equal((await request('GET', `/provider/teams/${teamId}/members`, secondManager)).status, 404);
    assert.equal((await request('PUT', `/provider/teams/${teamId}`, secondManager, { name: 'Stolen', capacity: 1, active: true })).status, 404);
    assert.equal((await request('GET', '/provider/teams', dispatcher)).status, 200);
    assert.equal((await request('PUT', `/provider/teams/${teamId}/availability-status`, dispatcher, { status: 'AVAILABLE' })).status, 404);
    const visibleCompanies = await request('GET', '/provider/companies', manager);
    assert.deepEqual(visibleCompanies.body.data.map((c: any) => c.id), [companyId]);
    assert.equal('commissionRate' in visibleCompanies.body.data[0], false);
    assert.equal((await request('PUT', `/provider/companies/${companyId}/profile`, manager, { name: 'Updated company' })).status, 200);
    assert.equal((await request('PUT', `/provider/companies/${companyId}/profile`, manager, { name: 'Updated', commissionRate: '0' })).status, 400);
    assert.equal((await request('PUT', `/provider/companies/${companyId}/profile`, secondManager, { name: 'Foreign' })).status, 404);
    assert.equal((await request('GET', '/admin/customers', admin)).status, 200);
    assert.equal((await request('GET', '/admin/customers', dispatcher)).status, 403);

    const extraDto = { code: 'WINDOWS', name: 'Windows', nameAr: 'نوافذ', price: '2.50', active: true };
    const extra = await request('POST', `/admin/services/${serviceId}/extras`, admin, extraDto);
    assert.equal(extra.status, 201);
    assert.equal((await request('GET', `/admin/services/${serviceId}/extras`, admin)).body.data[0].code, 'WINDOWS');
    assert.equal((await request('PUT', `/admin/services/${randomUUID()}/extras/${extra.body.data.id}`, admin, extraDto)).status, 404);
    assert.equal((await request('PUT', `/admin/services/${serviceId}/extras/${extra.body.data.id}`, admin, { ...extraDto, active: false })).status, 200);
    const publicDetail = await (await fetch(`${base}/services/${serviceId}`)).json() as any;
    assert.equal(publicDetail.data.extras.length, 0);
    assert.equal('createdAt' in publicDetail.data, false);
    assert.equal((await request('POST', `/admin/services/${serviceId}/extras`, manager, extraDto)).status, 403);

    const areaDto = { name: 'Amman', latitude: 31.95, longitude: 35.91, radiusKm: '10.000', active: true };
    const area = await request('POST', `/admin/companies/${companyId}/service-areas`, admin, areaDto);
    assert.equal(area.status, 201);
    assert.equal((await request('POST', `/admin/companies/${companyId}/service-areas`, admin, { ...areaDto, radiusKm: '0' })).status, 400);
    assert.equal((await request('GET', `/provider/companies/${companyId}/service-areas`, manager)).body.data.length, 1);
    assert.equal((await request('GET', `/provider/companies/${companyId}/service-areas`, secondManager)).status, 404);
    assert.equal((await request('PUT', `/admin/companies/${secondCompany.body.data.id}/service-areas/${area.body.data.id}`, admin, areaDto)).status, 404);
    assert.equal((await request('PUT', `/admin/companies/${companyId}/service-areas/${area.body.data.id}`, admin, { ...areaDto, active: false })).status, 200);

    const cleanerDto = { phone: '+962790000123', name: 'Cleaner', role: 'TEAM_LEADER_CLEANER', companyId, teamId };
    assert.equal((await request('POST', '/admin/users', manager, cleanerDto)).status, 403);
    assert.equal((await request('POST', '/admin/users', admin, { ...cleanerDto, companyId: secondCompany.body.data.id })).status, 404);
    const provisioned = await Promise.all([request('POST', '/admin/users', admin, cleanerDto), request('POST', '/admin/users', admin, cleanerDto)]);
    assert.deepEqual(provisioned.map(r => r.status), [201, 201]);
    const cleanerId = provisioned[0]!.body.data.id;
    assert.equal(provisioned[1]!.body.data.id, cleanerId);
    assert.equal(await db.userRole.count({ where: { userId: cleanerId, companyId, teamId } }), 1);
    assert.equal(await db.teamMember.count({ where: { userId: cleanerId, teamId } }), 1);
    const cleaner = await tokenFor(cleanerId);
    assert.deepEqual((await request('GET', '/provider/teams', cleaner)).body.data.map((t: any) => t.id), [teamId]);
    assert.equal((await request('GET', `/provider/teams/${teamId}/members`, cleaner)).body.data.length, 1);
    assert.equal((await request('GET', `/provider/teams/${secondTeam.body.data.id}/members`, cleaner)).status, 404);
    assert.equal((await request('PUT', `/provider/teams/${teamId}`, cleaner, { name: 'No', capacity: 1, active: true })).status, 404);
    assert.equal((await request('PUT', `/provider/teams/${teamId}/capabilities`, cleaner, { serviceIds: [serviceId] })).status, 404);
    assert.equal((await request('PUT', `/provider/teams/${teamId}/availability-status`, cleaner, { status: 'AVAILABLE' })).status, 200);
    const interval = { startsAt: '2027-01-01T10:00:00+03:00', endsAt: '2027-01-01T11:00:00+03:00', available: true };
    const availability = await request('POST', `/provider/teams/${teamId}/availability`, cleaner, interval);
    assert.equal(availability.status, 201);
    assert.equal(availability.body.data.startsAt, '2027-01-01T07:00:00.000Z');
    assert.equal((await request('POST', `/provider/teams/${teamId}/availability`, cleaner, { ...interval, startsAt: '2027-01-01T10:00:00' })).status, 400);
    assert.equal((await request('PUT', `/provider/teams/${secondTeam.body.data.id}/availability/${availability.body.data.id}`, admin, interval)).status, 404);
    assert.equal((await request('PUT', `/provider/teams/${teamId}/availability/${availability.body.data.id}`, cleaner, { ...interval, available: false })).status, 200);
    assert.equal((await request('DELETE', `/provider/teams/${teamId}/availability/${availability.body.data.id}`, cleaner)).status, 200);
    assert.equal((await request('GET', `/provider/teams/${teamId}/availability`, cleaner)).body.data.length, 0);

    assert.equal((await request('PUT', `/provider/teams/${teamId}/capabilities`, manager, { serviceIds: [serviceId] })).status, 200);
    assert.equal((await request('PUT', `/provider/teams/${teamId}/capabilities`, manager, { serviceIds: [randomUUID()] })).status, 400);
    assert.deepEqual((await request('GET', `/provider/teams/${teamId}/capabilities`, manager)).body.data.serviceIds, [serviceId]);
    const secondService = await request('POST', '/admin/services', admin, { ...dto, code: 'SECOND_SERVICE' });
    assert.equal(secondService.status, 201);
    const replacements = await Promise.all([
      request('PUT', `/provider/teams/${teamId}/capabilities`, manager, { serviceIds: [serviceId] }),
      request('PUT', `/provider/teams/${teamId}/capabilities`, manager, { serviceIds: [secondService.body.data.id] }),
    ]);
    assert.deepEqual(replacements.map(r => r.status), [200, 200]);
    const capabilities = (await request('GET', `/provider/teams/${teamId}/capabilities`, manager)).body.data.serviceIds;
    assert.equal(capabilities.length, 1, 'concurrent replacement must never merge two sets');

    // Force an actual PostgreSQL FK error at audit insertion, after the domain write.
    const { AdminCatalogService } = await import('../dist/core/admin-catalog.service.js');
    const invalidContext = { actor: { userId: randomUUID(), sessionId: randomUUID(), familyId: randomUUID(), scopes: [] }, requestId: 'rollback-test' };
    await assert.rejects(app.get(AdminCatalogService).create({ ...dto, code: 'ROLLBACK_SERVICE' }, invalidContext));
    assert.equal(await db.service.count({ where: { code: 'ROLLBACK_SERVICE' } }), 0);
    const { UsersService } = await import('../dist/core/users.service.js');
    await assert.rejects(app.get(UsersService).status(cleanerId, { status: 'SUSPENDED' }, invalidContext));
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: cleanerId } })).status, 'ACTIVE');
    assert.equal((await request('GET', '/auth/me', cleaner)).status, 200);
    await assert.rejects(app.get(UsersService).provision({ ...cleanerDto, phone: '+962790000124' }, invalidContext));
    assert.equal(await db.user.count({ where: { phone: '+962790000124' } }), 0);
    const { TeamsService } = await import('../dist/core/teams.service.js');
    const failedAuditContext = { ...invalidContext, actor: { ...invalidContext.actor, scopes: [{ role: 'HOME_CLEAN_ADMIN', companyId: null, teamId: null, permissions: ['team:manage'] }] } };
    await assert.rejects(app.get(TeamsService).capabilities(teamId, { serviceIds: [] }, failedAuditContext));
    assert.deepEqual((await request('GET', `/provider/teams/${teamId}/capabilities`, manager)).body.data.serviceIds, capabilities);

    // Saved address/property changes must leave historical booking snapshots untouched.
    const propertyDto = { type: 'APARTMENT', size: '100.00', rooms: 3, bathrooms: 2 };
    const property = await request('POST', '/customers/me/properties', customer, propertyDto);
    assert.equal(property.status, 201);
    assert.equal((await request('PUT', `/customers/me/properties/${property.body.data.id}`, other, propertyDto)).status, 404);
    const savedAddress = await db.address.findUniqueOrThrow({ where: { id: address.body.data.id } });
    const booking = await db.booking.create({ data: { bookingNumber: 'CORE-HISTORY', customerId: savedAddress.customerId, serviceId, propertyId: property.body.data.id, addressId: savedAddress.id, scheduledAt: new Date('2027-01-01T10:00:00Z'), estimatedEndAt: new Date('2027-01-01T11:00:00Z'), price: '12.50', addressSnapshot: addressDto, propertySnapshot: propertyDto, serviceSnapshot: dto, locationLatitude: addressDto.latitude, locationLongitude: addressDto.longitude } });
    assert.equal((await request('PUT', `/customers/me/addresses/${savedAddress.id}`, customer, { ...addressDto, addressText: 'Changed' })).status, 200);
    assert.equal((await request('DELETE', `/customers/me/addresses/${savedAddress.id}`, customer)).status, 200);
    assert.equal((await request('DELETE', `/customers/me/properties/${property.body.data.id}`, customer)).status, 200);
    assert.equal((await request('PUT', `/customers/me/properties/${property.body.data.id}`, customer, propertyDto)).status, 404);
    assert.equal((await request('GET', '/customers/me/addresses', customer)).body.data.length, 0);
    const history = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.deepEqual(history.addressSnapshot, addressDto);
    assert.deepEqual(history.propertySnapshot, propertyDto);

    assert.equal((await request('PUT', `/provider/teams/${teamId}`, manager, { name: 'Team', capacity: 3, active: false })).status, 200);
    assert.equal((await request('GET', '/provider/teams', cleaner)).status, 403);
    assert.equal((await request('PUT', `/provider/teams/${teamId}`, manager, { name: 'Team', capacity: 3, active: true })).status, 200);
    const companyDto = { internalCode: 'TEST-COMPANY', name: 'Test', status: 'SUSPENDED', commissionRate: '0.20' };
    assert.equal((await request('PUT', `/admin/companies/${companyId}`, admin, companyDto)).status, 200);
    assert.equal((await request('GET', '/provider/teams', manager)).status, 403);
    assert.equal((await request('GET', '/provider/teams', cleaner)).status, 403);
    assert.equal((await request('PUT', `/admin/companies/${companyId}`, admin, { ...companyDto, status: 'ACTIVE' })).status, 200);
    assert.equal((await request('PUT', `/admin/users/${cleanerId}/status`, admin, { status: 'SUSPENDED' })).status, 200);
    assert.equal((await request('GET', '/auth/me', cleaner)).status, 401);
    assert.equal(await db.session.count({ where: { userId: cleanerId, revokedAt: null } }), 0);
    assert.equal((await request('PUT', `/admin/users/${cleanerId}/status`, admin, { status: 'ACTIVE' })).status, 200);
    assert.equal((await request('GET', '/auth/me', cleaner)).status, 401, 'reactivation does not restore old sessions');
    const freshCleaner = await tokenFor(cleanerId);
    const grants = await request('GET', `/admin/users/${cleanerId}/roles`, admin);
    assert.equal(grants.status, 200);
    assert.equal((await request('DELETE', `/admin/users/${randomUUID()}/roles/${grants.body.data[0].id}`, admin)).status, 404);
    assert.equal((await request('DELETE', `/admin/users/${cleanerId}/roles/${grants.body.data[0].id}`, admin)).status, 200);
    assert.equal((await request('GET', '/auth/me', freshCleaner)).status, 401);
    assert.equal(await db.teamMember.count({ where: { userId: cleanerId, teamId, active: true } }), 0);
    assert.equal(await db.auditLog.count({ where: { resourceId: cleanerId, action: 'IDENTITY_ROLE_REVOKED' } }), 1);
  } finally { await app.close(); }
});
