import { redirect } from 'next/navigation';
import { PricingView } from '../../../../../components/provider-catalog';
import { ForbiddenRead, ReadError } from '../../../../../components/read-models';
import type { PricingRule, Promotion } from '../../../../../lib/admin-api';
import { adminGet } from '../../../../../lib/admin-api';
import { isLocale } from '../../../../../lib/i18n';
import { mayRenderAdminPage } from '../../../../../lib/session';
export default async function PromotionsPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) redirect('/en'); if (!await mayRenderAdminPage()) return <ForbiddenRead locale={locale} />; try { const [rules, promotions] = await Promise.all([adminGet<PricingRule[]>('/admin/pricing/rules?limit=100&offset=0'), adminGet<Promotion[]>('/admin/promotions?limit=100&offset=0')]); return <PricingView locale={locale} rules={rules} promotions={promotions} />; } catch (error) { return <ReadError locale={locale} error={error} />; } }
