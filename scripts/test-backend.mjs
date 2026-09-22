import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (process.env.NODE_ENV === 'production' || ['staging', 'production'].includes(process.env.APP_ENVIRONMENT))
  throw new Error('Integration tests cannot use staging or production');
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Tests require a local database');
const db = new pg.Client({ connectionString: url.toString() });
const tests = readdirSync('backend/nestjs/test').filter(name => name.endsWith('.test.ts')).map(name => `test/${name}`);
tests.push(...readdirSync('backend/nestjs/test/unit').filter(name => name.endsWith('.test.mjs')).map(name => `test/unit/${name}`));
const requested = process.argv.slice(2);
const selected = requested.length ? tests.filter(name => requested.includes(name.slice(name.lastIndexOf('/') + 1))) : tests;
if (requested.length && (selected.length !== requested.length || requested.some(name => !selected.some(path => path.endsWith(`/${name}`)))))
  throw new Error('Unknown or duplicate test filename');

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: 'backend/nestjs', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NODE_ENV: 'test', APP_ENVIRONMENT: 'test', DATABASE_URL: url.toString() } });
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`Validation command failed: ${args.join(' ')}`);
  }
  return result.stdout ?? '';
}

await db.connect();
let passed = 0;
try {
  run(['../../node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
  for (const path of selected) {
    const schema = `test_${randomUUID().replaceAll('-', '')}`;
    if (!/^test_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
    try {
      await db.query(`CREATE SCHEMA "${schema}"`);
      url.searchParams.set('schema', schema);
      if (!path.startsWith('test/unit/')) {
        run(['../../node_modules/prisma/build/index.js', 'migrate', 'deploy']);
        run(['../../node_modules/prisma/build/index.js', 'db', 'seed']);
      }
      const output = run(['--import', 'tsx', '--test', path]);
      const count = output.match(/ℹ pass (\d+)/)?.[1] ?? '?';
      console.log(`PASS ${path} (${count} assertions)`);
      passed++;
    } finally {
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
  }
  console.log(`Backend test files: ${passed}/${selected.length} passed on isolated schemas.`);
} finally {
  await db.end();
}
