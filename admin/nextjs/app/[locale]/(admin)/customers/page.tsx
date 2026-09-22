import { redirect } from 'next/navigation';
import { CustomersView, ForbiddenRead, ReadError } from '../../../../components/read-models';
import type { AdminCustomerSummary } from '../../../../lib/admin-api';
import { adminGet, queryString } from '../../../../lib/admin-api';
import { isLocale } from '../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../lib/session';

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect('/en');
  if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, one(value)]).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0));
  const queryPath = queryString(Object.fromEntries(['status', 'locale', 'query'].map(key => [key, query[key]])));
  try { return <CustomersView locale={locale} rows={await adminGet<AdminCustomerSummary[]>(`/admin/customers?limit=100&offset=0${queryPath}`)} query={query} />; }
  catch (error) { return <ReadError locale={locale} error={error} />; }
}
