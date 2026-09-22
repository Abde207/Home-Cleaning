import { redirect } from 'next/navigation';
import { CustomerDetailView, ForbiddenRead, ReadError } from '../../../../../components/read-models';
import type { AdminCustomerDetail } from '../../../../../lib/admin-api';
import { adminGet } from '../../../../../lib/admin-api';
import { isLocale } from '../../../../../lib/i18n';
import { platformPermissions } from '../../../../../lib/permissions';
import { mayRenderAdminPage, sessionIdentity } from '../../../../../lib/session';

export default async function CustomerDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) redirect('/en');
  if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  try {
    const [row, identity] = await Promise.all([adminGet<AdminCustomerDetail>(`/admin/customers/${id}`), sessionIdentity()]);
    return <CustomerDetailView locale={locale} row={row} canManage={platformPermissions(identity).has('identity:manage')} />;
  } catch (error) { return <ReadError locale={locale} error={error} notFound />; }
}
