import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '../../../../components/login-form';
import { isLocale } from '../../../../lib/i18n';
import { isPlatformAdmin } from '../../../../lib/permissions';
import { sessionIdentity } from '../../../../lib/session';
import { messagesFor } from '../../../../messages';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect('/en/login');
  try { if (isPlatformAdmin(await sessionIdentity())) redirect(`/${locale}`); } catch (error) {
    // Do not turn Next's redirect into a failed session lookup.
    if (error && typeof error === 'object' && 'digest' in error) throw error;
  }
  const t = messagesFor(locale);
  return <main className="auth-page"><div className="auth-card">
    <div className="brand"><span>{t.brand}</span><small>{t.product}</small></div>
    <div className="locale-switch"><Link href={`/${locale === 'ar' ? 'en' : 'ar'}/login`}>{t.language}</Link></div>
    <h1>{t.signInTitle}</h1><p>{t.signInDescription}</p>
    <LoginForm locale={locale} />
  </div></main>;
}

