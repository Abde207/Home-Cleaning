'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '../lib/i18n';
import { messagesFor } from '../messages';

export function SessionRefresh({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/session/refresh', { method: 'POST' }).then(response => {
      if (!active) return;
      if (response.ok) router.refresh();
      else { setFailed(true); router.replace(`/${locale}/login`); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [locale, router]);
  const t = messagesFor(locale);
  return <main className="center-state" role="status"><p>{failed ? t.sessionExpired : t.signingIn}</p>{failed && <a href={`/${locale}/login`}>{t.signInTitle}</a>}</main>;
}

