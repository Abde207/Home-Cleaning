import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Locale } from '../lib/i18n';
import { visibleNavigation, type Identity } from '../lib/permissions';
import { messagesFor } from '../messages';
import { SignOut } from './sign-out';

export function AdminShell({ locale, identity, children }: { locale: Locale; identity: Identity; children: ReactNode }) {
  const t = messagesFor(locale);
  const other = locale === 'ar' ? 'en' : 'ar';
  const activeRoutes = new Set(['', '/operations/bookings', '/operations/dispatch', '/finance/payments', '/finance/cash', '/finance/settlements', '/governance/users', '/governance/audit', '/customers', '/providers/companies', '/providers/teams', '/catalog/services', '/catalog/pricing', '/catalog/promotions']);
  return <div className="shell">
    <a className="skip-link" href="#main">{t.skipToContent}</a>
    <aside className="sidebar" aria-label={t.product}>
      <div className="brand"><span>{t.brand}</span><small>{t.product}</small></div>
      <nav aria-label={t.product}>{visibleNavigation(identity).map(group => <section key={group.label}>
        <h2>{t[group.label]}</h2>
        <ul>{group.items.map(item => <li key={item.label}>
          {activeRoutes.has(item.path) ? <Link href={`/${locale}${item.path}`} aria-current={item.path === '' ? 'page' : undefined}>{t[item.label]}</Link>
            : <span className="nav-planned" title={t.comingLater} aria-disabled="true">{t[item.label]}</span>}
        </li>)}</ul>
      </section>)}</nav>
    </aside>
    <div className="shell-main">
      <header className="topbar">
        <span>{t.signedInAs} <strong>{identity.name ?? identity.phone}</strong></span>
        <div className="top-actions"><Link href={`/${other}`}>{t.language}</Link><SignOut locale={locale} /></div>
      </header>
      <main id="main" className="content">{children}</main>
    </div>
  </div>;
}
