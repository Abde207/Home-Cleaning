import { redirect } from 'next/navigation';
import { ForbiddenRead, ReadError, UsersView } from '../../../../../components/read-models';
import type { AdminUserSummary } from '../../../../../lib/admin-api';
import { adminGet, queryString } from '../../../../../lib/admin-api';
import { isLocale } from '../../../../../lib/i18n';
import { platformPermissions } from '../../../../../lib/permissions';
import { mayRenderAdminPage, sessionIdentity } from '../../../../../lib/session';

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function UsersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect('/en');
  if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, one(value)]).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0));
  const queryPath = queryString(Object.fromEntries(['status', 'role', 'query'].map(key => [key, query[key]])));
  try { const identity = await sessionIdentity(); return <UsersView locale={locale} rows={await adminGet<AdminUserSummary[]>(`/admin/users?limit=100&offset=0${queryPath}`)} query={query} canManage={platformPermissions(identity).has('identity:manage')} />; }
  catch (error) { return <ReadError locale={locale} error={error} />; }
}
