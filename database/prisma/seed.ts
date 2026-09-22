import { PrismaClient, RoleName } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '../../.env', quiet: true });
const prisma = new PrismaClient();
const permissions: Record<RoleName, string[]> = {
  CUSTOMER: ['profile:own', 'address:own', 'property:own', 'booking:own', 'payment:own', 'rating:own', 'support:own', 'notification:own'],
  COMPANY_MANAGER: ['company:own', 'team:company', 'assignment:company', 'settlement:company', 'notification:own'],
  TEAM_LEADER_CLEANER: ['assignment:team', 'job:team', 'cash:team', 'notification:own'],
  DISPATCHER: ['booking:operations', 'dispatch:manage', 'company:read', 'team:read', 'notification:own'],
  HOME_CLEAN_ADMIN: [
    'booking:operations', 'dispatch:manage', 'company:manage', 'team:manage', 'customer:read', 'service:manage',
    'pricing:manage', 'payment:manage', 'refund:manage', 'settlement:manage', 'support:manage', 'promotion:manage',
    'audit:read', 'identity:manage', 'notification:own',
    'admin:dashboard:read', 'identity:read', 'payment:read', 'refund:read', 'cash:read', 'settlement:read',
    'notification:operations:read',
  ],
};

try {
  await prisma.$transaction(async tx => {
    for (const [name, codes] of Object.entries(permissions)) {
      const role = await tx.role.upsert({ where: { name: name as RoleName }, create: { name: name as RoleName }, update: {} });
      for (const code of codes) {
        const permission = await tx.permission.upsert({ where: { code }, create: { code }, update: {} });
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          create: { roleId: role.id, permissionId: permission.id }, update: {},
        });
      }
    }
    // Catalog drafts only: no commercial price or service is activated by seed.
    for (const service of [
      { code: 'REGULAR_CLEANING', name: 'Regular Cleaning', nameAr: 'تنظيف دوري' },
      { code: 'DEEP_CLEANING', name: 'Deep Cleaning', nameAr: 'تنظيف عميق' },
    ]) {
      await tx.service.upsert({ where: { code: service.code }, create: { ...service, basePrice: '0.00', durationMinutes: 120, active: false }, update: {} });
    }
  });
  console.log(`Seed verified: ${await prisma.role.count()} roles, ${await prisma.permission.count()} permissions, ${await prisma.service.count()} catalog drafts.`);
} finally {
  await prisma.$disconnect();
}
