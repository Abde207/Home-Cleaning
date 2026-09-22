/** Isolated in-process fallback for Windows hosts that block Node child processes. */
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { after } from 'node:test';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import ts from 'typescript';

if (process.env.NODE_ENV === 'production' || ['staging', 'production'].includes(process.env.APP_ENVIRONMENT))
  throw new Error('Tests cannot use staging or production');
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Tests require a local database');
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const db = new pg.Client({ connectionString: url.toString() });
const temporary = [];
function transpile(path) {
  const output = path.replace(/\.ts$/, `.${schema}.mjs`);
  const source = readFileSync(path, 'utf8');
  writeFileSync(output, ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText);
  temporary.push(output);
  return pathToFileURL(output).href;
}
await db.connect();
try {
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.query(`SET search_path TO "${schema}", public`);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = 'test';
  process.env.APP_ENVIRONMENT = 'test';
  const migrations = readdirSync('database/prisma/migrations', { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const migration of migrations) {
    await db.query('BEGIN');
    try {
      await db.query(readFileSync(`database/prisma/migrations/${migration}/migration.sql`, 'utf8'));
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
  }
  await import(transpile('database/prisma/seed.ts'));
} catch (error) {
  for (const path of temporary) unlinkSync(path);
  await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.end();
  throw error;
}
after(async () => {
  for (const path of temporary) unlinkSync(path);
  await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.end();
});
await import(transpile('backend/nestjs/test/worker-recovery.test.ts'));
