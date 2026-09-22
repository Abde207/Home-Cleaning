'use client';

import { useState } from 'react';
import type { Locale } from '../lib/i18n';
import { messagesFor } from '../messages';

export function FinanceCommand({ locale, path, label, warning }: { locale: Locale; path: string; label: string; warning: string }) {
  const [busy, setBusy] = useState(false);
  const t = messagesFor(locale);
  return <button type="button" disabled={busy} onClick={async () => { if (!window.confirm(warning)) return; setBusy(true); try { const response = await fetch(`/api/admin/command/${path}`, { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } }); if (!response.ok) throw new Error('command failed'); window.location.reload(); } catch { window.alert(t.commandFailed); } finally { setBusy(false); } }}>{busy ? t.retrying : label}</button>;
}
