'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { AdminBookingDetail, AdminTeam } from '../lib/admin-api';
import type { Locale } from '../lib/i18n';
import { messagesFor } from '../messages';

type Failure = Error & { status?: number; code?: string };

function status(value: string) { return value.replaceAll('_', ' '); }

async function sendCommand(path: string, body: unknown, idempotencyKey: string) {
  const response = await fetch(`/api/admin/command/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    const failure = new Error(payload?.error?.message ?? 'The command failed.') as Failure;
    failure.status = response.status; failure.code = payload?.error?.code;
    throw failure;
  }
}

export function BookingActions({ locale, booking, teams, canDispatch, canOperate }: {
  locale: Locale; booking: AdminBookingDetail; teams: AdminTeam[]; canDispatch: boolean; canOperate: boolean;
}) {
  const t = messagesFor(locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(teams.find(team => team.active && team.status === 'AVAILABLE')?.id ?? teams[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState(false);
  const keys = useRef(new Map<string, string>());
  const latest = booking.assignments.at(-1);
  const assignable = ['PAYMENT_CONFIRMED', 'SEARCHING_FOR_TEAM', 'REJECTED', 'TEAM_NO_SHOW', 'TEAM_ASSIGNED'].includes(booking.status);
  const activeAccepted = latest?.status === 'ACCEPTED';

  async function run(name: string, path: string, body: unknown, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setError(null); setBusy(true);
    const token = `${name}:${JSON.stringify(body)}`;
    const idempotencyKey = keys.current.get(token) ?? `admin-14e-${crypto.randomUUID()}`;
    keys.current.set(token, idempotencyKey);
    try {
      await sendCommand(path, body, idempotencyKey);
      window.location.reload();
    } catch (failure) {
      const problem = failure as Failure;
      setError(problem.status === 409 ? t.commandRefresh : (problem.message || t.commandFailed));
      setBusy(false);
      if (problem.status === 409) window.setTimeout(() => window.location.reload(), 700);
    }
  }

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const team = teams.find(item => item.id === teamId);
    if (!team || !reason.trim()) { setError(t.dispatchReason); return; }
    const body = { companyId: team.companyId, teamId: team.id, reason: reason.trim(), ...(override ? { overrideAvailabilityAndArea: true } : {}) };
    const confirmation = override ? `${t.overrideWarning}\n\n${t.dispatchCommandWarning}` : t.dispatchCommandWarning;
    void run('manual', `dispatch/bookings/${booking.id}/manual`, body, confirmation);
  }

  function cancel() {
    const body = { reason: reason.trim() || 'Admin operational cancellation' };
    void run('cancel', `bookings/${booking.id}/cancel`, body, t.cancelWarning);
  }

  if ((!canDispatch && !canOperate) || booking.status === 'COMPLETED' || booking.status === 'CANCELLED' || booking.status === 'REFUNDED' || booking.status === 'CUSTOMER_NO_SHOW') return null;

  return <section className="panel">
    <h2>{t.actions}</h2>
    <p className="read-only-note">{t.dispatchCommandWarning}</p>
    <div className="command-form">
      {canDispatch && assignable && <div className="form-grid">
        <button type="button" disabled={busy} onClick={() => void run('offer', `dispatch/bookings/${booking.id}/offer`, {}, t.dispatchCommandWarning)}>{busy ? t.retrying : t.automaticOffer}</button>
        {(booking.status === 'REJECTED' || booking.status === 'TEAM_NO_SHOW') && <button className="secondary" type="button" disabled={busy} onClick={() => void run('retry', `bookings/${booking.id}/retry-assignment`, {}, t.dispatchCommandWarning)}>{t.retryAssignment}</button>}
        {booking.status === 'SEARCHING_FOR_TEAM' && <button className="secondary" type="button" disabled={busy} onClick={() => void run('no-team', `bookings/${booking.id}/no-team-available`, {}, t.dispatchCommandWarning)}>{t.markNoTeamAvailable}</button>}
      </div>}

      {canDispatch && assignable && <form className="command-form" onSubmit={submitManual}>
        <fieldset><legend>{t.manualDispatch}</legend><p className="read-only-note">{t.manualDispatchDescription}</p>
          <label>{t.team}<select required value={teamId} onChange={event => setTeamId(event.target.value)} disabled={busy}><option value="">{t.selectTeam}</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name} · {team.status}{team.active ? '' : ' · inactive'}</option>)}</select></label>
          <label>{t.dispatchReason}<textarea required minLength={1} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /></label>
          <label className="check-field"><input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} disabled={busy} />{t.overrideAvailability}</label>
          {override && <small className="read-only-note">{t.overrideWarning}</small>}
          <button type="submit" disabled={busy || !teamId}>{busy ? t.retrying : t.manualDispatch}</button>
        </fieldset>
      </form>}

      {canOperate && activeAccepted && <fieldset><legend>{t.noShow}</legend><p className="read-only-note">{booking.status === 'TEAM_ON_THE_WAY' ? t.teamNoShow : t.customerNoShow}</p>
        {booking.status === 'TEAM_ON_THE_WAY' && <button className="secondary" type="button" disabled={busy} onClick={() => void run('team-no-show', `assignments/${latest!.id}/team-no-show`, {}, t.dispatchCommandWarning)}>{t.teamNoShow}</button>}
        {booking.status === 'CLEANING_STARTED' && <button className="secondary" type="button" disabled={busy} onClick={() => void run('customer-no-show', `assignments/${latest!.id}/customer-no-show`, {}, t.dispatchCommandWarning)}>{t.customerNoShow}</button>}
      </fieldset>}

      {canOperate && ['REQUESTED', 'PRICE_CONFIRMED', 'PAYMENT_PENDING', 'TEAM_ASSIGNED'].includes(booking.status) && <button className="secondary" type="button" disabled={busy} onClick={cancel}>{t.cancelBooking}</button>}
      {canDispatch && ['TEAM_ACCEPTED', 'TEAM_ON_THE_WAY', 'CLEANING_STARTED'].includes(booking.status) && <p className="read-only-note">{t.unsupportedReassignment}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}
