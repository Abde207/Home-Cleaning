import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

if (process.env.NODE_ENV !== 'production') config({ path: '../../.env', quiet: true });
export default defineConfig({
  schema: '../../database/prisma/schema.prisma',
  migrations: { path: '../../database/prisma/migrations', seed: 'tsx ../../database/prisma/seed.ts' },
});
