import { notFound, redirect } from 'next/navigation';
import { PaymentDetailView } from '../../../../../../components/finance';
import { ReadError, ForbiddenRead } from '../../../../../../components/read-models';
import type { AdminPaymentDetail } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { isLocale } from '../../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../../lib/session';
import { sessionIdentity } from '../../../../../../lib/session';
import { platformPermissions } from '../../../../../../lib/permissions';
type Params = { locale: string; id: string };
export default async function Page({ params }: { params: Promise<Params> }) { const { locale, id } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />; try { const identity = await sessionIdentity(); return <PaymentDetailView locale={locale} payment={await adminGet<AdminPaymentDetail>(`/admin/payments/${id}`)} canManage={platformPermissions(identity).has('payment:manage')} />; } catch (error) { if (error instanceof Error && error.message === 'NOT_FOUND') notFound(); return <ReadError locale={locale} error={error} />; } }
