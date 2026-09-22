import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

test('Phase 13D team management and provider-safe settlement visibility enforce provider scopes', async () => {
  const { createApp } = await import('../dist/bootstrap.js');
  const { PrismaService } = await import('../dist/database/database.module.js');
  const { sessionHash } = await import('../dist/auth/authorization.js');
  const app = await createApp();
  const db = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    async function identity(roleName: string, companyId?: string, teamId?: string) {
      const role = await db.role.findUniqueOrThrow({ where: { name: roleName as never } });
      const user = await db.user.create({ data: {
        phone: `+p13d-${randomUUID()}`.slice(0, 20), name: `${roleName} test`, customer: { create: {} },
        roles: { create: { roleId: role.id, ...(companyId ? { companyId } : {}), ...(teamId ? { teamId } : {}) } },
        ...(teamId ? { memberships: { create: { teamId, name: 'Cleaner', role: 'LEADER' } } } : {}),
      } });
      const token = randomBytes(32).toString('base64url');
      await db.session.create({ data: { userId: user.id, accessTokenHash: sessionHash(token), refreshTokenHash: sessionHash(randomBytes(32).toString('hex')), accessExpiresAt: new Date(Date.now() + 600000), expiresAt: new Date(Date.now() + 1200000) } });
      return token;
    }
    async function request(path: string, token: string) {
      const response = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
      return { status: response.status, body: await response.json() as any };
    }
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const company = await db.company.create({ data: { internalCode: `D13-C1-${suffix}`, name: 'Phase 13D Company', status: 'ACTIVE', commissionRate: '0.21' } });
    const foreignCompany = await db.company.create({ data: { internalCode: `D13-C2-${suffix}`, name: 'Foreign Company', status: 'ACTIVE', commissionRate: '0.34' } });
    const team = await db.team.create({ data: { companyId: company.id, internalCode: `D13-T1-${suffix}`, name: 'Provider Team', capacity: 3, status: 'AVAILABLE', active: true, latitude: '31.9500000', longitude: '35.9100000', locationAt: new Date('2028-01-01T09:00:00Z') } });
    const secondTeam = await db.team.create({ data: { companyId: company.id, internalCode: `D13-T2-${suffix}`, name: 'Second Team', capacity: 2, status: 'PAUSED', active: true } });
    const foreignTeam = await db.team.create({ data: { companyId: foreignCompany.id, internalCode: `D13-T3-${suffix}`, name: 'Foreign Team', capacity: 4, status: 'AVAILABLE', active: true } });
    const manager = await identity('COMPANY_MANAGER', company.id);
    const foreignManager = await identity('COMPANY_MANAGER', foreignCompany.id);
    const cleaner = await identity('TEAM_LEADER_CLEANER', company.id, team.id);
    const customer = await identity('CUSTOMER');
    const admin = await identity('HOME_CLEAN_ADMIN');
    const dispatcher = await identity('DISPATCHER');

    const managerList = await request('/provider/teams?limit=1&offset=0', manager);
    assert.equal(managerList.status, 200);
    assert.equal(managerList.body.data.length, 1);
    assert.equal((await request('/provider/teams?limit=1&offset=1', manager)).body.data.length, 1);
    const detail = await request(`/provider/teams/${team.id}`, manager);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.company.id, company.id);
    assert.equal(detail.body.data.latitude, '31.95');
    assert.equal('commissionRate' in detail.body.data.company, false);
    assert.equal((await request(`/provider/teams/${team.id}`, foreignManager)).status, 404);
    assert.equal((await request(`/provider/teams/${foreignTeam.id}`, manager)).status, 404);
    assert.equal((await request(`/provider/teams/${team.id}`, cleaner)).status, 200);
    assert.equal((await request(`/provider/teams/${secondTeam.id}`, cleaner)).status, 404);
    assert.equal((await request(`/provider/teams/${team.id}`, customer)).status, 403);
    assert.equal((await request(`/provider/teams/${team.id}`, admin)).status, 200);
    assert.equal((await request(`/provider/teams/${team.id}`, dispatcher)).status, 200);
    assert.equal((await request(`/provider/teams/${team.id}/members`, cleaner)).body.data.length, 1);

    const service = await db.service.create({ data: { code: `D13-S-${suffix}`, name: 'Safe service', nameAr: 'خدمة آمنة', basePrice: '60.00', durationMinutes: 90, active: true } });
    const customerUser = await db.user.create({ data: { phone: `+d13-c-${suffix}`.slice(0, 20), name: 'Private Customer', customer: { create: {} } } });
    const customerRow = await db.customer.findUniqueOrThrow({ where: { userId: customerUser.id } });
    const address = await db.address.create({ data: { customerId: customerRow.id, label: 'Private home', addressText: 'Secret address', latitude: '31.9', longitude: '35.9' } });
    const property = await db.property.create({ data: { customerId: customerRow.id, type: 'APARTMENT', size: '80', rooms: 2, bathrooms: 1 } });
    const booking = await db.booking.create({ data: { bookingNumber: `HC-D13-${suffix}`, customerId: customerRow.id, serviceId: service.id, propertyId: property.id, addressId: address.id, scheduledAt: new Date('2028-01-02T10:00:00Z'), estimatedEndAt: new Date('2028-01-02T11:30:00Z'), status: 'COMPLETED', paymentMethod: 'ONLINE', price: '60.00', currency: 'JOD', addressSnapshot: { addressText: 'Secret address' }, propertySnapshot: { type: 'APARTMENT' }, serviceSnapshot: { name: 'Safe service', nameAr: 'خدمة آمنة', internalCost: 'NEVER' }, locationLatitude: '31.9', locationLongitude: '35.9' } });
    const payable = await db.providerPayable.create({ data: { bookingId: booking.id, companyId: company.id, customerAmount: '60.00', commissionRate: '0.21', platformCommission: '12.60', providerAmount: '47.40', cashCollected: '0.00', netPayable: '47.40', calculationSnapshot: { platformCommission: '12.60', secret: true } } });
    const settlement = await db.settlement.create({ data: { companyId: company.id, reference: `HC-D13-SET-${suffix}`, status: 'PAID', periodStart: new Date('2028-01-01T00:00:00Z'), periodEnd: new Date('2028-02-01T00:00:00Z'), total: '47.40', currency: 'JOD', version: 2 } });
    await db.settlementItem.create({ data: { settlementId: settlement.id, payableId: payable.id, companyId: company.id, amount: '47.40' } });
    await db.settlementPayment.create({ data: { settlementId: settlement.id, amount: '47.40', direction: 'TO_PROVIDER', reference: `D13-PAYOUT-${suffix}`, paidAt: new Date('2028-02-02T00:00:00Z') } });
    await db.settlementReconciliation.create({ data: { settlementId: settlement.id, runNumber: 1, status: 'MATCHED', expectedCustomerTotal: '60.00', allocatedPaymentTotal: '60.00', refundTotal: '0', payoutTotal: '47.40', difference: '0', details: { secret: 'internal' } } });
    const foreignSettlement = await db.settlement.create({ data: { companyId: foreignCompany.id, reference: `HC-D13-FOR-${suffix}`, status: 'CALCULATED', periodStart: new Date('2028-01-01T00:00:00Z'), periodEnd: new Date('2028-02-01T00:00:00Z'), total: '20', currency: 'JOD' } });

    const list = await request('/provider/settlements?limit=1&offset=0', manager);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].companyId, company.id);
    assert.equal(list.body.data[0].paidAmount, '47.4');
    assert.equal(list.body.data[0].workItemCount, 1);
    const finance = await request(`/provider/settlements/${settlement.id}`, manager);
    assert.equal(finance.status, 200);
    assert.equal(finance.body.data.workItems[0].booking.bookingNumber, booking.bookingNumber);
    assert.deepEqual(finance.body.data.workItems[0].booking.service, { name: 'Safe service', nameAr: 'خدمة آمنة' });
    assert.equal(finance.body.data.latestReconciliation.status, 'MATCHED');
    const serialized = JSON.stringify(finance.body.data);
    for (const forbidden of ['platformCommission', 'commissionRate', 'calculationSnapshot', 'allocations', 'customerId', 'addressText', 'details', 'history']) assert.equal(serialized.includes(forbidden), false, forbidden);
    assert.equal((await request(`/settlements/${settlement.id}`, manager)).status, 403);
    assert.equal((await request(`/settlements/${settlement.id}`, admin)).status, 200);
    assert.equal((await request(`/provider/settlements/${foreignSettlement.id}`, manager)).status, 404);
    assert.equal((await request(`/provider/settlements/${settlement.id}`, foreignManager)).status, 404);
    assert.equal((await request('/provider/settlements', cleaner)).status, 403);
    assert.equal((await request('/provider/settlements', customer)).status, 403);
    assert.equal((await request('/provider/settlements', admin)).status, 403);
    assert.equal((await request('/provider/settlements', dispatcher)).status, 403);
    assert.equal((await request('/provider/settlements?limit=101', manager)).status, 400);
  } finally {
    await app.close();
  }
});
