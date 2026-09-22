import { redirect } from 'next/navigation';
import { LocationsView } from '../../../../../components/observability';
import { ReadError, ForbiddenRead } from '../../../../../components/read-models';
import type { AdminLocations } from '../../../../../lib/admin-api';
import { adminGet, queryString } from '../../../../../lib/admin-api';
import { isLocale } from '../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../lib/session';

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) { const { locale } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />; const raw = await searchParams; const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, one(value)]).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)); const path = queryString({ companyId: query.companyId, teamId: query.teamId, teamStatus: query.teamStatus, freshness: query.freshness, locationAvailability: query.locationAvailability }); try { return <LocationsView locale={locale} data={await adminGet<AdminLocations>(`/admin/operations/locations${path}`)} query={raw} />; } catch (error) { return <ReadError locale={locale} error={error} />; } }
