import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

if (existsSync('.env')) throw new Error('.env already exists; refusing to replace local credentials');
const password = randomBytes(32).toString('hex');
mkdirSync('.local', { recursive: true });
writeFileSync('.env', `NODE_ENV=development\nPORT=3001\nDATABASE_URL=postgresql://homeclean:${password}@127.0.0.1:55432/homeclean?schema=public\nREDIS_URL=redis://127.0.0.1:56379\nPOSTGRES_USER=homeclean\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=homeclean\nCORS_ORIGINS=http://localhost:3000\n`, { mode: 0o600 });
writeFileSync('.local/bootstrap.sql', `CREATE ROLE homeclean LOGIN PASSWORD '${password}';\nCREATE DATABASE homeclean OWNER homeclean;\n`, { mode: 0o600 });
console.log('Created ignored local configuration and one-time database bootstrap SQL.');
writeFileSync('.env', `OTP_HASH_SECRET=${randomBytes(32).toString('hex')}\nOTP_DELIVERY_MODE=file\nPAYMENT_PROVIDER=mock\nPAYMENT_WEBHOOK_SECRET=${randomBytes(32).toString('hex')}\nBACKEND_API_URL=http://127.0.0.1:3001/api/v1\n`, { flag: 'a' });
