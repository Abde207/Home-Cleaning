import { redirect } from 'next/navigation';
import { ServiceDetailManagementView } from '../../../../../../components/provider-catalog-management';
import { ForbiddenRead, ReadError } from '../../../../../../components/read-models';
import type { AdminExtra, AdminService } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { isLocale } from '../../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../../lib/session';
import { ApiError } from '../../../../../../lib/api';
export default async function ServiceDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) { const { locale, id } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />; try { const services = await adminGet<AdminService[]>('/admin/services?limit=100&offset=0'); const row = services.find(item => item.id === id); if (!row) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Not found'); const extras = await adminGet<AdminExtra[]>(`/admin/services/${id}/extras?limit=100&offset=0`); return <ServiceDetailManagementView locale={locale} row={row} extras={extras} />; } catch (error) { return <ReadError locale={locale} error={error} notFound={error instanceof ApiError && error.status === 404} />; } }
