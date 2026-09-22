import { redirect } from 'next/navigation';
import { ForbiddenRead, GrantsView, ReadError } from '../../../../../../components/read-models';
import type { AdminUserSummary, RoleGrant } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { isLocale } from '../../../../../../lib/i18n';
import { platformPermissions } from '../../../../../../lib/permissions';
import { mayRenderAdminPage, sessionIdentity } from '../../../../../../lib/session';

export default async function UserGrantsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) redirect('/en');
  if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  try {
    const [users, grants] = await Promise.all([
      adminGet<AdminUserSummary[]>('/admin/users?limit=100&offset=0'),
      adminGet<RoleGrant[]>(`/admin/users/${id}/roles`),
    ]);
    const user = users.find(row => row.id === id);
    if (!user) return <ReadError locale={locale} error={new Error('not found')} notFound />;
    const identity = await sessionIdentity();
    return <GrantsView locale={locale} user={user} grants={grants} canManage={platformPermissions(identity).has('identity:manage')} />;
  } catch (error) { return <ReadError locale={locale} error={error} notFound />; }
}
