'use client';

import { useState, type FormEvent } from 'react';
import type { Locale } from '../lib/i18n';
import { messagesFor } from '../messages';

async function command(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  const response = await fetch(path, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message ?? 'The command failed.');
}

export function StatusControl({ locale, userId, currentStatus, canManage }: { locale: Locale; userId: string; currentStatus: string; canManage: boolean }) {
  const t = messagesFor(locale);
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canManage) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    if (status === currentStatus) return;
    if (status !== 'ACTIVE' && !window.confirm(t.statusWarning)) return;
    setBusy(true);
    try { await command(`/api/admin/users/${userId}/status`, 'PUT', { status }); window.location.reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t.commandFailed); setBusy(false); }
  }
  return <form className="action-form" onSubmit={submit}><label>{t.status}<select value={status} onChange={event => setStatus(event.target.value)} disabled={busy}>{['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].map(value => <option key={value}>{value}</option>)}</select></label><button type="submit" disabled={busy || status === currentStatus}>{busy ? t.saving : t.saveStatus}</button>{error && <p className="form-error" role="alert">{error}</p>}<small>{t.statusWarning}</small></form>;
}

export function ProvisionUserForm({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); const form = new FormData(event.currentTarget);
    const body = Object.fromEntries([...form.entries()].filter(([, value]) => String(value).length > 0));
    setBusy(true);
    try { await command('/api/admin/users', 'POST', body); window.location.reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t.commandFailed); setBusy(false); }
  }
  return <form className="action-form provision-form" onSubmit={submit}><h2>{t.provisionTitle}</h2><p>{t.provisionWarning}</p><label>{t.phone}<input name="phone" required pattern="\+[1-9][0-9]{7,14}" /></label><label>{t.name}<input name="name" required maxLength={120} /></label><label>{t.role}<select name="role" defaultValue="CUSTOMER"><option>CUSTOMER</option><option>COMPANY_MANAGER</option><option>TEAM_LEADER_CLEANER</option><option>HOME_CLEAN_ADMIN</option><option>DISPATCHER</option></select></label><label>{t.companyId}<input name="companyId" /></label><label>{t.teamId}<input name="teamId" /></label><button type="submit" disabled={busy}>{busy ? t.saving : t.provision}</button>{error && <p className="form-error" role="alert">{error}</p>}</form>;
}

export function RevokeGrantButton({ locale, userId, grantId, canManage }: { locale: Locale; userId: string; grantId: string; canManage: boolean }) {
  const t = messagesFor(locale); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  if (!canManage) return null;
  async function revoke() {
    if (!window.confirm(t.revokeWarning)) return; setError(null); setBusy(true);
    try { await command(`/api/admin/users/${userId}/roles/${grantId}`, 'DELETE'); window.location.reload(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t.commandFailed); setBusy(false); }
  }
  return <span className="action-inline"><button type="button" onClick={revoke} disabled={busy}>{busy ? t.saving : t.revoke}</button>{error && <small className="form-error">{error}</small>}</span>;
}
