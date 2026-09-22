import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '../../../components/admin-shell';
import { SessionRefresh } from '../../../components/session-refresh';
import { SignOut } from '../../../components/sign-out';
import { ApiError } from '../../../lib/api';
import { isLocale } from '../../../lib/i18n';
import { isPlatformAdmin } from '../../../lib/permissions';
import { REFRESH_COOKIE, sessionIdentity } from '../../../lib/session';
import { messagesFor } from '../../../messages';

export default async function ProtectedLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect('/en');
  try {
    const identity = await sessionIdentity();
    if (!isPlatformAdmin(identity)) return <main className="center-state"><h1>{messagesFor(locale).forbiddenTitle}</h1><p>{messagesFor(locale).forbiddenDescription}</p><SignOut locale={locale} /></main>;
    return <AdminShell locale={locale} identity={identity}>{children}</AdminShell>;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if ((await cookies()).has(REFRESH_COOKIE)) return <SessionRefresh locale={locale} />;
      redirect(`/${locale}/login`);
    }
    if (error instanceof ApiError && error.status === 403) return <main className="center-state"><h1>{messagesFor(locale).forbiddenTitle}</h1><p>{messagesFor(locale).forbiddenDescription}</p><SignOut locale={locale} /></main>;
    return <main className="center-state" role="alert"><h1>{messagesFor(locale).unexpectedTitle}</h1><p>{messagesFor(locale).serviceUnavailable}</p>{error instanceof ApiError && error.requestId && <small>{messagesFor(locale).requestId}: {error.requestId}</small>}</main>;
  }
}
