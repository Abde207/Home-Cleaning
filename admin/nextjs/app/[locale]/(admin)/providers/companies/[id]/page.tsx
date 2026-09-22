import { redirect } from 'next/navigation';
import { CompanyDetailManagementView } from '../../../../../../components/provider-catalog-management';
import { ForbiddenRead, ReadError } from '../../../../../../components/read-models';
import type { AdminCompanyDetail } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { isLocale } from '../../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../../lib/session';
import { ApiError } from '../../../../../../lib/api';
export default async function CompanyDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  try { return <CompanyDetailManagementView locale={locale} row={await adminGet<AdminCompanyDetail>(`/admin/companies/${id}`)} />; }
  catch (error) { return <ReadError locale={locale} error={error} notFound={error instanceof ApiError && error.status === 404} />; }
}
