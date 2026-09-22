import { redirect } from 'next/navigation';
import { NotificationsView } from '../../../../../components/observability';
import { ReadError, ForbiddenRead } from '../../../../../components/read-models';
import type { AdminNotificationDelivery } from '../../../../../lib/admin-api';
import { adminGet, queryString } from '../../../../../lib/admin-api';
import { isLocale } from '../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../lib/session';

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function instant(value: string | undefined) { if (!value) return undefined; const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value; }
export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) { const { locale } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />; const raw = await searchParams; const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, one(value)]).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)); const path = queryString({ status: query.status, type: query.type, category: query.category, userId: query.userId, referenceType: query.referenceType, referenceId: query.referenceId, createdFrom: instant(query.createdFrom), createdTo: instant(query.createdTo) }); try { return <NotificationsView locale={locale} rows={await adminGet<AdminNotificationDelivery[]>(`/admin/notification-deliveries${path}`)} query={raw} />; } catch (error) { return <ReadError locale={locale} error={error} />; } }
