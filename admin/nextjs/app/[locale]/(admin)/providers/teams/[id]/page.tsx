import { redirect } from 'next/navigation';
import { TeamDetailManagementView } from '../../../../../../components/provider-catalog-management';
import { ForbiddenRead, ReadError } from '../../../../../../components/read-models';
import type { AdminService, AdminTeamDetail, TeamAvailability, TeamMember } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { isLocale } from '../../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../../lib/session';
import { ApiError } from '../../../../../../lib/api';
export default async function TeamDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  try { const [row, members, availability, capabilities, services] = await Promise.all([adminGet<AdminTeamDetail>(`/provider/teams/${id}`), adminGet<TeamMember[]>(`/provider/teams/${id}/members?limit=100&offset=0`), adminGet<TeamAvailability[]>(`/provider/teams/${id}/availability?limit=100&offset=0`), adminGet<{ serviceIds: string[] }>(`/provider/teams/${id}/capabilities`), adminGet<AdminService[]>('/admin/services?limit=100&offset=0')]); return <TeamDetailManagementView locale={locale} row={row} members={members} availability={availability} capabilities={capabilities.serviceIds} services={services} />; }
  catch (error) { return <ReadError locale={locale} error={error} notFound={error instanceof ApiError && error.status === 404} />; }
}
