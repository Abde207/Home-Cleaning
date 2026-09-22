'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '../lib/i18n';
import { messagesFor } from '../messages';

export function SignOut({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const t = messagesFor(locale);
  return <><button type="button" className="secondary" onClick={async () => {
    try {
      const result = await fetch('/api/session/logout', { method: 'POST' });
      if (!result.ok) throw new Error('Logout was not confirmed');
      router.replace(`/${locale}/login`);
      router.refresh();
    } catch { setFailed(true); }
  }}>{t.signOut}</button>{failed && <span role="alert">{t.serviceUnavailable}</span>}</>;
}
