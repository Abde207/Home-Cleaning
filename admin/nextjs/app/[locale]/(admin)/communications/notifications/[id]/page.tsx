import { redirect } from 'next/navigation';
import { NotificationDetailView } from '../../../../../../components/observability';
import { ReadError, ForbiddenRead } from '../../../../../../components/read-models';
import type { AdminNotificationDeliveryDetail } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { isLocale } from '../../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../../lib/session';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) { const { locale, id } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />; try { return <NotificationDetailView locale={locale} row={await adminGet<AdminNotificationDeliveryDetail>(`/admin/notification-deliveries/${id}`)} />; } catch (error) { return <ReadError locale={locale} error={error} notFound={error instanceof Error && 'status' in error && (error as { status?: number }).status === 404} />; } }
