'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '../lib/i18n';
import { messagesFor } from '../messages';

type Failure = { success: false; error: { code: string; message: string }; meta?: { requestId?: string | null } };

export function LoginForm({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(challengeId ? '/api/session/verify' : '/api/session/otp', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(challengeId ? { challengeId, code } : { phone }),
      });
      const payload = await response.json() as { success: true; data: { challengeId?: string } } | Failure;
      if (!response.ok || !payload.success) {
        const failure = payload as Failure;
        setError(response.status === 403 ? t.forbiddenDescription : `${failure.error?.message ?? t.serviceUnavailable}${failure.meta?.requestId ? ` (${t.requestId}: ${failure.meta.requestId})` : ''}`);
      } else if (challengeId) {
        router.replace(`/${locale}`);
        router.refresh();
      } else if (payload.data.challengeId) {
        setChallengeId(payload.data.challengeId);
      }
    } catch { setError(t.serviceUnavailable); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="login-form">
    {challengeId ? <>
      <label htmlFor="code">{t.codeLabel}</label>
      <input id="code" value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required />
      <button type="submit" disabled={busy}>{busy ? t.signingIn : t.verifyCode}</button>
      <button type="button" className="secondary" onClick={() => { setChallengeId(null); setCode(''); setError(null); }}>{t.changePhone}</button>
    </> : <>
      <label htmlFor="phone">{t.phoneLabel}</label>
      <input id="phone" type="tel" dir="ltr" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" placeholder="+962790000000" pattern="\+[1-9][0-9]{7,14}" required />
      <small>{t.phoneHint}</small>
      <button type="submit" disabled={busy}>{busy ? t.signingIn : t.sendCode}</button>
    </>}
    {error && <p className="alert" role="alert">{error}</p>}
  </form>;
}

