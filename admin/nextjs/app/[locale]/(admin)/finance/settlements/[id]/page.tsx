import { redirect } from 'next/navigation';
import { SettlementDetailView } from '../../../../../../components/finance';
import { ReadError, ForbiddenRead } from '../../../../../../components/read-models';
import type { AdminSettlementDetail } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { isLocale } from '../../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../../lib/session';
import { sessionIdentity } from '../../../../../../lib/session';
import { platformPermissions } from '../../../../../../lib/permissions';
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) { const { locale, id } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />; try { const identity = await sessionIdentity(); return <SettlementDetailView locale={locale} settlement={await adminGet<AdminSettlementDetail>(`/admin/settlements/${id}`)} canManage={platformPermissions(identity).has('settlement:manage')} />; } catch (error) { return <ReadError locale={locale} error={error} />; } }
