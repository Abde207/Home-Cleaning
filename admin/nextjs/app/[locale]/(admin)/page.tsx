import { redirect } from 'next/navigation';
import { DashboardView, ForbiddenRead, ReadError } from '../../../components/read-models';
import type { AdminDashboard } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { isLocale } from '../../../lib/i18n';
import { mayRenderAdminPage } from '../../../lib/session';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect('/en');
  if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />;
  try { return <DashboardView locale={locale} data={await adminGet<AdminDashboard>('/admin/dashboard')} />; }
  catch (error) { return <ReadError locale={locale} error={error} />; }
}
