import { redirect } from 'next/navigation';
import { TeamsView } from '../../../../../components/provider-catalog';
import { ForbiddenRead, ReadError } from '../../../../../components/read-models';
import type { AdminTeam } from '../../../../../lib/admin-api';
import { adminGet, queryString } from '../../../../../lib/admin-api';
import { isLocale } from '../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../lib/session';
type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
export default async function TeamsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  const raw = await searchParams; const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, one(value)]).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0));
  try { return <TeamsView locale={locale} rows={await adminGet<AdminTeam[]>(`/provider/teams?limit=100&offset=0${queryString({ companyId: query.companyId, status: query.status, active: query.active, query: query.query })}`)} query={query} />; }
  catch (error) { return <ReadError locale={locale} error={error} />; }
}
