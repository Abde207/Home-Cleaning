/** Local validation when Prisma's schema-engine child cannot spawn. Never targets a nonlocal database. */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';
import ts from 'typescript';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (process.env.NODE_ENV === 'production' || ['staging', 'production'].includes(process.env.APP_ENVIRONMENT))
  throw new Error('Integration tests cannot use staging or production');
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Tests require a local database');
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const db = new pg.Client({ connectionString: url.toString() });
const temporaryTests = [];
await db.connect();
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: 'backend/nestjs',
    env: { ...process.env, NODE_ENV: 'test', APP_ENVIRONMENT: 'test', DATABASE_URL: url.toString() }, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Validation command failed: ${args[0]}`);
}
try {
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.query(`SET search_path TO "${schema}", public`);
  url.searchParams.set('schema', schema);
  if (process.env.DISPATCH_EXTERNAL_WORKERS_DIR)
    writeFileSync(join(process.env.DISPATCH_EXTERNAL_WORKERS_DIR, 'schema.txt'), schema);
  const migrations = readdirSync('database/prisma/migrations', { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const migration of migrations) {
    const sql = readFileSync(`database/prisma/migrations/${migration}/migration.sql`, 'utf8');
    await db.query('BEGIN');
    try { await db.query(sql); await db.query('COMMIT'); }
    catch (error) { await db.query('ROLLBACK'); throw error; }
  }
  run(['--import', 'tsx', '../../database/prisma/seed.ts']);
  run(['../../node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
  const tests = readdirSync('backend/nestjs/test').filter(name => name.endsWith('.test.ts')).map(name => `test/${name}`);
  tests.push(...readdirSync('backend/nestjs/test/unit').filter(name => name.endsWith('.test.mjs')).map(name => `test/unit/${name}`));
  const requested = process.argv.slice(2);
  if (requested.includes('dispatch.process.validation.ts')) tests.push('test/dispatch.process.validation.ts');
  const selected = requested.length ? tests.filter(name => requested.includes(name.slice(name.lastIndexOf('/') + 1))) : tests;
  if (requested.length && (selected.length !== requested.length || requested.some(name => !selected.some(path => path.endsWith(`/${name}`)))))
    throw new Error('Unknown or duplicate test filename');
  const runnable = selected.map(path => {
    if (!path.endsWith('.ts')) return path;
    const output = path.replace('test/', 'test/.direct-').replace(/\.ts$/, '.mjs');
    const source = readFileSync(`backend/nestjs/${path}`, 'utf8');
    writeFileSync(`backend/nestjs/${output}`, ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
    } }).outputText);
    temporaryTests.push(output);
    return output;
  });
  run(['--test', '--test-isolation=none', ...runnable]);
} finally {
  for (const path of temporaryTests) unlinkSync(`backend/nestjs/${path}`);
  if (!/^test_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
  await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.end();
}
