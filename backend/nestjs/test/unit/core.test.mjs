import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canManage, canOperate, teamScope, audit } from '../../dist/core/core.policy.js';
import * as dto from '../../dist/core/core.dto.js';
import { CustomersService } from '../../dist/core/customers.service.js';
import { TeamsService } from '../../dist/core/teams.service.js';
import { CompaniesService } from '../../dist/core/companies.service.js';
import { CatalogService } from '../../dist/core/catalog.service.js';
import { UsersService } from '../../dist/core/users.service.js';
import { AdminCatalogService } from '../../dist/core/admin-catalog.service.js';
import { CompaniesController } from '../../dist/core/providers.controller.js';
import { UsersController } from '../../dist/core/users.controller.js';
import { AdminServicesController } from '../../dist/core/services.controller.js';
import { AdminCustomersController } from '../../dist/core/customers.controller.js';

const companyId = randomUUID(), teamId = randomUUID();
const actor = (...scopes) => ({ userId: randomUUID(), sessionId: randomUUID(), familyId: randomUUID(), scopes });
const manager = actor({ role: 'COMPANY_MANAGER', companyId, teamId: null, permissions: ['team:company', 'company:own'] });
const cleaner = actor({ role: 'TEAM_LEADER_CLEANER', companyId, teamId, permissions: ['job:team'] });
const context = (identity = manager) => ({ actor: identity, requestId: 'core-test' });
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (type, body) => pipe.transform(body, { type: 'body', metatype: type });
const status = code => error => error.getStatus?.() === code;

test('team policy binds role, company and team within the same grant', () => {
  assert.equal(canManage(manager, companyId), true);
  assert.equal(canManage(manager, randomUUID()), false);
  assert.equal(canManage(cleaner, companyId), false);
  assert.equal(canOperate(cleaner, { id: teamId, companyId }), true);
  assert.equal(canOperate(cleaner, { id: randomUUID(), companyId }), false);
  assert.equal(canOperate(cleaner, { id: teamId, companyId: randomUUID() }), false);
  assert.deepEqual(teamScope(cleaner), { OR: [{ companyId, id: teamId }] });
  assert.throws(() => teamScope(actor()), status(403));
  const split = actor({ role: 'COMPANY_MANAGER', companyId, permissions: [] }, { role: 'COMPANY_MANAGER', companyId: randomUUID(), permissions: ['team:company'] });
  assert.equal(canManage(split, companyId), false);
});

test('dispatcher reads operational teams but cannot change their configuration', () => {
  const dispatcher = actor({ role: 'DISPATCHER', companyId: null, teamId: null, permissions: ['team:read'] });
  assert.deepEqual(teamScope(dispatcher), {});
  assert.equal(canManage(dispatcher, companyId), false);
  assert.equal(canOperate(dispatcher, { id: teamId, companyId }), false);
});

test('privileged controllers keep explicit global-guard permission metadata', () => {
  assert.equal(Reflect.getMetadata('permission', CompaniesController), 'company:manage');
  assert.equal(Reflect.getMetadata('permission', UsersController), 'identity:manage');
  assert.equal(Reflect.getMetadata('permission', AdminServicesController), 'service:manage');
  assert.equal(Reflect.getMetadata('permission', AdminCustomersController), 'customer:read');
  for (const controller of [CompaniesController, UsersController, AdminServicesController, AdminCustomersController]) {
    assert.equal(Reflect.getMetadata('platform', controller), true);
  }
});

test('list pagination validates bounds and reaches the scoped database query', async () => {
  const page = await pipe.transform({ limit: '10', offset: '20' }, { type: 'query', metatype: dto.ListQueryDto });
  assert.equal(page.limit, 10);
  assert.equal(page.offset, 20);
  for (const input of [{ limit: '101' }, { limit: '0' }, { offset: '-1' }, { offset: '1000001' }, { limit: '1.5' }, { limit: 'NaN' }, { companyId }]) {
    await assert.rejects(pipe.transform(input, { type: 'query', metatype: dto.ListQueryDto }), status(400));
  }
  await new TeamsService({ team: { findMany: async query => {
    assert.equal(query.take, 10);
    assert.equal(query.skip, 20);
    assert.deepEqual(query.where, { OR: [{ companyId }] });
    return [];
  } } }).list(context(), page);
});

test('customer administration returns an explicit profile projection', async () => {
  const customer = { id: teamId, user: { name: 'Customer', phone: '+962790000000', locale: 'ar', status: 'ACTIVE' } };
  const db = { customer: {
    findMany: async ({ select }) => { assert.equal(select.user.select.roles, undefined); assert.equal(select.user.select.sessions, undefined); return [customer]; },
    findUniqueOrThrow: async ({ where }) => { assert.deepEqual(where, { id: teamId }); return customer; },
  } };
  const service = new CustomersService(db);
  assert.deepEqual(await service.list(), [{ id: teamId, ...customer.user }]);
  assert.deepEqual(await service.detail(teamId), { id: teamId, ...customer.user });
});

test('DTOs reject ownership injection, reassignment and financial profile injection', async () => {
  const address = { label: 'Home', addressText: 'Amman', latitude: 31.95, longitude: 35.91 };
  await validate(dto.AddressDto, address);
  await assert.rejects(validate(dto.AddressDto, { ...address, customerId: randomUUID() }), status(400));
  await assert.rejects(validate(dto.AddressDto, { ...address, latitude: 91 }), status(400));
  await assert.rejects(validate(dto.TeamUpdateDto, { name: 'Team', capacity: 1, active: true, companyId: randomUUID() }), status(400));
  await assert.rejects(validate(dto.CompanyProfileDto, { name: 'Company', commissionRate: '0.5' }), status(400));
  await assert.rejects(validate(dto.ProfileDto, { name: null }), status(400));
});

test('catalog money remains decimal text and rejects precision loss', async () => {
  const extra = { code: 'EXTRA', name: 'Extra', nameAr: 'إضافة', price: '12.50', active: true };
  await validate(dto.ServiceExtraDto, extra);
  for (const price of [12.5, '-1', '0.001', '1e2', '10000000000.00', null]) {
    await assert.rejects(validate(dto.ServiceExtraDto, { ...extra, price }), status(400));
  }
});

test('availability requires timezone and capability sets reject duplicate IDs', async () => {
  const interval = { startsAt: '2027-01-01T10:00:00+03:00', endsAt: '2027-01-01T11:00:00+03:00', available: true };
  await validate(dto.AvailabilityDto, interval);
  for (const startsAt of ['2027-01-01', '2027-01-01T10:00:00', '2027-02-30T10:00:00Z']) {
    await assert.rejects(validate(dto.AvailabilityDto, { ...interval, startsAt }), status(400));
  }
  await assert.rejects(validate(dto.CapabilitiesDto, { serviceIds: [teamId, teamId] }), status(400));
  await validate(dto.CapabilitiesDto, { serviceIds: [] });
});

test('invalid role/scope combinations are rejected before persistence', () => {
  const users = new UsersService({ $transaction: () => assert.fail('must not write') });
  for (const scope of [
    { role: 'CUSTOMER', companyId }, { role: 'HOME_CLEAN_ADMIN', teamId },
    { role: 'COMPANY_MANAGER' }, { role: 'COMPANY_MANAGER', companyId, teamId },
    { role: 'TEAM_LEADER_CLEANER', companyId },
  ]) assert.throws(() => users.provision({ phone: '+962790000000', name: 'Test', ...scope }, context()), status(400));
});

test('catalog reads filter inactive services and extras and omit internal fields', async () => {
  const catalog = new CatalogService({ service: {
    findMany: async query => {
      assert.deepEqual(query.where, { active: true });
      assert.deepEqual(query.select.extras.where, { active: true });
      assert.equal(query.select.createdAt, undefined);
      assert.equal(query.select.active, undefined);
      return [];
    },
    findFirst: async query => { assert.deepEqual(query.where, { id: teamId, active: true }); return null; },
  } });
  assert.deepEqual(await catalog.list(), []);
  await assert.rejects(catalog.detail(teamId), status(404));
});

test('customer writes use server-derived ownership and reject archived records', async () => {
  const service = new CustomersService({
    customer: { findUnique: async query => { assert.equal(query.where.userId, manager.userId); return { id: companyId }; } },
    address: { update: async query => { assert.deepEqual(query.where, { id: teamId, customerId: companyId, archivedAt: null }); return {}; } },
    property: { update: async query => { assert.deepEqual(query.where, { id: teamId, customerId: companyId, archivedAt: null }); return {}; } },
  });
  await service.updateAddress(manager, teamId, { label: 'Home' });
  await service.saveProperty(manager, { size: '12.50' }, teamId);
  await assert.rejects(service.saveProperty(manager, { size: '0' }), status(400));
});

test('company provider projections omit commission and enforce company scope', async () => {
  const companies = new CompaniesService({ company: { findMany: async query => {
    assert.deepEqual(query.where, { id: { in: [companyId] } });
    assert.deepEqual(Object.keys(query.select).sort(), ['id', 'name', 'status']);
    return [];
  } } });
  await companies.visible(manager);
  assert.throws(() => companies.visible(cleaner), status(403));
  assert.throws(() => companies.profile(randomUUID(), { name: 'Foreign' }, context()), status(404));
});

test('foreign teams fail before member reads or mutation', async () => {
  const tx = { team: { findFirst: async query => { assert.deepEqual(query.where.AND, [{ id: teamId }, { OR: [{ companyId }] }]); return null; } } };
  const teams = new TeamsService({ ...tx, $transaction: callback => callback(tx) });
  await assert.rejects(teams.members(teamId, context()), status(404));
  await assert.rejects(teams.update(teamId, { name: 'No', capacity: 1, active: false }, context()), status(404));
});

test('cleaner can change own availability but cannot replace capabilities', async () => {
  const team = { id: teamId, companyId, status: 'OFFLINE' };
  const actions = [];
  const tx = {
    team: { findFirst: async () => team, update: async ({ data }) => ({ id: teamId, ...data }) },
    $queryRaw: async () => [],
    auditLog: { create: async ({ data }) => actions.push(data.action) },
  };
  const teams = new TeamsService({ $transaction: callback => callback(tx) });
  assert.deepEqual(await teams.status(teamId, { status: 'AVAILABLE' }, context(cleaner)), { id: teamId, status: 'AVAILABLE' });
  assert.deepEqual(actions, ['TEAM_AVAILABILITY_STATUS_CHANGED']);
  await assert.rejects(teams.capabilities(teamId, { serviceIds: [] }, context(cleaner)), status(404));
});

test('invalid intervals are rejected without opening a transaction', () => {
  const teams = new TeamsService({ $transaction: () => assert.fail('must not write') });
  for (const [startsAt, endsAt] of [['invalid', 'invalid'], ['2027-01-02', '2027-01-01'], ['2027-01-01', '2027-01-01']]) {
    assert.throws(() => teams.availability(teamId, { startsAt, endsAt, available: true }, context()), status(400));
  }
});

test('capability replacement locks team and keeps writes and audit in transaction callback', async () => {
  const order = [], selected = randomUUID();
  const tx = {
    team: { findFirst: async () => ({ id: teamId, companyId }) },
    $queryRaw: async () => order.push('lock'),
    teamServiceCapability: {
      findMany: async () => [{ serviceId: selected }],
      deleteMany: async () => order.push('delete'),
      createMany: async () => order.push('create'),
    },
    auditLog: { create: async ({ data }) => { order.push('audit'); assert.deepEqual(data.before, { serviceIds: [selected] }); } },
  };
  const teams = new TeamsService({ $transaction: callback => callback(tx) });
  await teams.capabilities(teamId, { serviceIds: [] }, context());
  assert.deepEqual(order, ['lock', 'delete', 'create', 'audit']);
});

test('audit failure propagates from privileged transaction instead of returning success', async () => {
  const failure = new Error('injected audit failure');
  const tx = { service: { create: async () => ({ id: teamId }) }, auditLog: { create: async () => { throw failure; } } };
  const service = new AdminCatalogService({ $transaction: callback => callback(tx) });
  await assert.rejects(service.create({}, context()), error => error === failure);
});

test('audit serialization preserves decimal text and UTC timestamps', async () => {
  await audit({ auditLog: { create: async ({ data }) => {
    assert.deepEqual(data.after, { price: '12.5', time: '2027-01-01T00:00:00.000Z' });
    assert.equal(data.actorUserId, manager.userId);
    assert.equal(data.requestId, 'core-test');
  } } }, context(), 'TEST', 'Service', teamId, { price: new Prisma.Decimal('12.50'), time: new Date('2027-01-01T00:00:00Z') });
});

test('role removal deactivates membership and revokes sessions within the same transaction', async () => {
  const grantId = randomUUID(), calls = [];
  const tx = {
    $queryRaw: async () => calls.push('lock'),
    userRole: {
      findUniqueOrThrow: async ({ where }) => { assert.deepEqual(where, { id: grantId, userId: manager.userId }); return { role: { name: 'TEAM_LEADER_CLEANER' }, companyId, teamId }; },
      delete: async () => calls.push('grant'),
    },
    teamMember: { updateMany: async ({ where, data }) => { assert.deepEqual(where, { teamId, userId: manager.userId }); assert.equal(data.active, false); calls.push('member'); } },
    session: { updateMany: async ({ where, data }) => { assert.deepEqual(where, { userId: manager.userId, revokedAt: null }); assert.ok(data.revokedAt instanceof Date); calls.push('sessions'); } },
    auditLog: { create: async () => calls.push('audit') },
  };
  assert.deepEqual(await new UsersService({ $transaction: callback => callback(tx) }).revoke(manager.userId, grantId, context()), { revoked: true });
  assert.deepEqual(calls, ['lock', 'grant', 'member', 'sessions', 'audit']);
});
