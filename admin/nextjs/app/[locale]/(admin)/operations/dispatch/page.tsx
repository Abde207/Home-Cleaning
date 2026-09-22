import { redirect } from 'next/navigation';
import { DispatchView, ForbiddenRead, ReadError } from '../../../../../components/read-models';
import type { AdminBookingSummary, DispatchMonitoring } from '../../../../../lib/admin-api';
import { adminGet } from '../../../../../lib/admin-api';
import { isLocale } from '../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../lib/session';

export default async function DispatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect('/en');
  if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  try {
    const [monitoring, pendingOffers] = await Promise.all([
      adminGet<DispatchMonitoring>('/dispatch/monitoring'),
      adminGet<AdminBookingSummary[]>('/admin/bookings?status=TEAM_ASSIGNED&limit=100&offset=0'),
    ]);
    return <DispatchView locale={locale} monitoring={monitoring} pendingOffers={pendingOffers.filter(row => row.currentAssignment?.status === 'OFFERED')} />;
  } catch (error) { return <ReadError locale={locale} error={error} />; }
}
