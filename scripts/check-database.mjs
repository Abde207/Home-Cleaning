import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';

if (process.env.NODE_ENV === 'production' || ['staging', 'production'].includes(process.env.APP_ENVIRONMENT)) throw new Error('Validation cannot run in staging or production');
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('This validation is local-only');
const schema = `validation_${randomUUID().replaceAll('-', '')}`;
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
async function migrate() {
  const migrations = readdirSync('database/prisma/migrations', { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const migration of migrations) {
    const sql = readFileSync(`database/prisma/migrations/${migration}/migration.sql`, 'utf8');
    await client.query('BEGIN');
    try { await client.query(sql); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  }
}
async function seed() {
  process.env.DATABASE_URL = url.toString();
  await import(`../database/prisma/seed.ts?validation=${randomUUID()}`);
}
let passed = 0;
async function rejects(sql, values, code) {
  await client.query('SAVEPOINT invalid_operation');
  await assert.rejects(client.query(sql, values), e => e.code === code);
  await client.query('ROLLBACK TO SAVEPOINT invalid_operation');
  passed++;
}
try {
  await client.query(`CREATE SCHEMA "${schema}"`);
  url.searchParams.set('schema', schema);
  await client.query(`SET search_path TO "${schema}", public`);
  await migrate();
  await seed();
  const seedBefore = await client.query('SELECT (SELECT count(*) FROM "Role") AS roles, (SELECT count(*) FROM "Permission") AS permissions, (SELECT count(*) FROM "RolePermission") AS grants, (SELECT count(*) FROM "Service") AS services');
  await seed();
  const seedAfter = await client.query('SELECT (SELECT count(*) FROM "Role") AS roles, (SELECT count(*) FROM "Permission") AS permissions, (SELECT count(*) FROM "RolePermission") AS grants, (SELECT count(*) FROM "Service") AS services');
  assert.deepEqual(seedAfter.rows, seedBefore.rows);
  assert.equal(seedAfter.rows[0].roles, '5');
  assert.equal(seedAfter.rows[0].services, '2');
  assert.equal((await client.query('SELECT count(*) AS n FROM "Service" WHERE active')).rows[0].n, '0');
  passed += 3;
  await client.query('BEGIN');
  const [user, customer, otherUser, otherCustomer, company, team, service, address, property, booking, booking2] = Array.from({ length: 11 }, () => randomUUID());
  await client.query('INSERT INTO "User" (id,phone,"updatedAt") VALUES ($1,$2,now()),($3,$4,now())', [user, '+962790000001', otherUser, '+962790000002']);
  await client.query('INSERT INTO "Customer" (id,"userId") VALUES ($1,$2),($3,$4)', [customer, user, otherCustomer, otherUser]);
  await client.query('INSERT INTO "Company" (id,"internalCode",name,"commissionRate","updatedAt") VALUES ($1,\'TEST\',\'Test\',0.2,now())', [company]);
  await client.query('INSERT INTO "Team" (id,"companyId","internalCode",name,"updatedAt") VALUES ($1,$2,\'TEST-T\',\'Team\',now())', [team, company]);
  await client.query('INSERT INTO "Service" (id,code,name,"nameAr","basePrice","durationMinutes","updatedAt") VALUES ($1,\'TEST\',\'Test\',\'اختبار\',10.25,60,now())', [service]);
  await rejects('UPDATE "Service" SET "basePrice" = -1 WHERE id=$1', [service], '23514');
  await client.query('INSERT INTO "Address" (id,"customerId",label,"addressText",latitude,longitude) VALUES ($1,$2,\'Home\',\'Original\',31.95,35.91)', [address, customer]);
  await client.query('INSERT INTO "Property" (id,"customerId",type,size,rooms,bathrooms) VALUES ($1,$2,\'APARTMENT\',80,2,1)', [property, customer]);
  const bookingSql = 'INSERT INTO "Booking" (id,"bookingNumber","customerId","serviceId","propertyId","addressId","scheduledAt","estimatedEndAt",price,"addressSnapshot","propertySnapshot","serviceSnapshot","locationLatitude","locationLongitude","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,\'2027-01-01T10:00:00Z\',\'2027-01-01T11:00:00Z\',10.25,\'{"addressText":"Original"}\',\'{}\',\'{}\',31.95,35.91,now())';
  await rejects(bookingSql, [booking, 'FOREIGN', otherCustomer, service, property, address], '23503');
  await client.query(bookingSql, [booking, 'TEST-1', customer, service, property, address]);
  await client.query(bookingSql, [booking2, 'TEST-2', customer, service, property, address]);
  await client.query('UPDATE "Address" SET "addressText"=\'Changed\' WHERE id=$1', [address]);
  assert.equal((await client.query('SELECT "addressSnapshot",price FROM "Booking" WHERE id=$1', [booking])).rows[0].addressSnapshot.addressText, 'Original');
  assert.equal((await client.query('SELECT price FROM "Booking" WHERE id=$1', [booking])).rows[0].price, '10.25');
  passed += 2;
  await rejects('UPDATE "Booking" SET "addressSnapshot"=\'{}\' WHERE id=$1', [booking], '23514');
  await rejects('DELETE FROM "Customer" WHERE id=$1', [customer], '23503');
  const assignmentSql = 'INSERT INTO "Assignment" (id,"bookingId","companyId","teamId","startsAt","endsAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,now()+interval \'10 minutes\')';
  await client.query(assignmentSql, [randomUUID(), booking, company, team, '2027-01-01T10:00Z', '2027-01-01T11:00Z']);
  await rejects(assignmentSql, [randomUUID(), booking, company, team, '2027-01-01T12:00Z', '2027-01-01T13:00Z'], '23505');
  await rejects(assignmentSql, [randomUUID(), booking2, company, team, '2027-01-01T10:30Z', '2027-01-01T11:30Z'], '23P01');
  await client.query(assignmentSql, [randomUUID(), booking2, company, team, '2027-01-01T11:00Z', '2027-01-01T12:00Z']);
  passed++;
  await rejects('INSERT INTO "Rating" (id,"bookingId","customerId",score) VALUES ($1,$2,$3,6)', [randomUUID(), booking, customer], '23514');
  await rejects('INSERT INTO "Rating" (id,"bookingId","customerId",score) VALUES ($1,$2,$3,5)', [randomUUID(), booking, otherCustomer], '23503');
  const audit = randomUUID();
  await client.query('INSERT INTO "AuditLog" (id,action,"resourceType","resourceId") VALUES ($1,\'TEST\',\'Booking\',$2)', [audit, booking]);
  await rejects('DELETE FROM "AuditLog" WHERE id=$1', [audit], '23514');
  await rejects('INSERT INTO "ProviderPayable" (id,"bookingId","companyId","customerAmount","commissionRate","platformCommission","providerAmount","cashCollected","netPayable") VALUES ($1,$2,$3,10,0.2,2,9,0,9)', [randomUUID(), booking, company], '23514');
  await client.query('ROLLBACK');
  console.log(`PASS: fresh migrations, seed repeatability and ${passed} integrity assertions in isolated schema.`);
} finally {
  await client.query('ROLLBACK');
  if (!/^validation_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe cleanup schema');
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await client.end();
}
