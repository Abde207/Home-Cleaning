import { redirect } from 'next/navigation';
import { ServicesView } from '../../../../../components/provider-catalog';
import { ForbiddenRead, ReadError } from '../../../../../components/read-models';
import type { AdminService } from '../../../../../lib/admin-api';
import { adminGet } from '../../../../../lib/admin-api';
import { isLocale } from '../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../lib/session';
export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />; try { return <ServicesView locale={locale} rows={await adminGet<AdminService[]>('/admin/services?limit=100&offset=0')} />; } catch (error) { return <ReadError locale={locale} error={error} />; } }
