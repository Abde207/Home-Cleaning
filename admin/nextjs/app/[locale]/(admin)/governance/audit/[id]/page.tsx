import { redirect } from 'next/navigation';
import { AuditDetailView, ForbiddenRead, ReadError } from '../../../../../../components/read-models';
import type { AuditDetail } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { isLocale } from '../../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../../lib/session';

export default async function AuditDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) redirect('/en');
  if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  try { return <AuditDetailView locale={locale} row={await adminGet<AuditDetail>(`/admin/audit-logs/${id}`)} />; }
  catch (error) { return <ReadError locale={locale} error={error} notFound />; }
}
