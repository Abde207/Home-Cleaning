import { redirect } from 'next/navigation';
import { BookingDetailView, ForbiddenRead, ReadError } from '../../../../../../components/read-models';
import type { AdminBookingDetail, AdminTeam } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { ApiError } from '../../../../../../lib/api';
import { isLocale } from '../../../../../../lib/i18n';
import { mayRenderAdminPage, sessionIdentity } from '../../../../../../lib/session';
import { platformPermissions } from '../../../../../../lib/permissions';

export default async function BookingDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) redirect('/en');
  if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  try {
    const identity = await sessionIdentity();
    const permissions = platformPermissions(identity);
    const canDispatch = permissions.has('dispatch:manage');
    const canOperate = permissions.has('booking:operations');
    const [booking, teams] = await Promise.all([
      adminGet<AdminBookingDetail>(`/admin/bookings/${id}`),
      canDispatch ? adminGet<AdminTeam[]>('/provider/teams?limit=100&offset=0').catch(() => [] as AdminTeam[]) : Promise.resolve([] as AdminTeam[]),
    ]);
    return <BookingDetailView locale={locale} booking={booking} teams={teams} canDispatch={canDispatch} canOperate={canOperate} />;
  }
  catch (error) { return <ReadError locale={locale} error={error} notFound={error instanceof ApiError ? error.status === 404 : true} />; }
}
