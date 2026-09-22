export type Scope = { role: string; companyId: string | null; teamId: string | null; permissions: string[] };
export type Identity = { id: string; name: string | null; phone: string; locale: string; scopes: Scope[] };

export function platformPermissions(identity: Identity): Set<string> {
  return new Set(identity.scopes
    .filter(scope => scope.role === 'HOME_CLEAN_ADMIN' && scope.companyId === null && scope.teamId === null)
    .flatMap(scope => scope.permissions));
}

export function isPlatformAdmin(identity: Identity) {
  return identity.scopes.some(scope => scope.role === 'HOME_CLEAN_ADMIN' && scope.companyId === null && scope.teamId === null);
}

export type NavigationItem = { label: string; path: string; anyOf: readonly string[] };
export type NavigationGroup = { label: string; items: readonly NavigationItem[] };

// Route metadata only. Later phases add pages and backend calls; this list grants no access.
export const navigation = [
  { label: 'groupOverview', items: [{ label: 'navDashboard', path: '', anyOf: ['admin:dashboard:read'] }] },
  { label: 'groupOperations', items: [
    { label: 'navBookings', path: '/operations/bookings', anyOf: ['booking:operations'] },
    { label: 'navDispatch', path: '/operations/dispatch', anyOf: ['dispatch:manage'] },
    { label: 'navLocations', path: '/operations/locations', anyOf: ['admin:dashboard:read'] },
  ] },
  { label: 'groupCustomers', items: [{ label: 'navCustomers', path: '/customers', anyOf: ['customer:read'] }] },
  { label: 'groupProviders', items: [
    { label: 'navCompanies', path: '/providers/companies', anyOf: ['company:manage'] },
    { label: 'navTeams', path: '/providers/teams', anyOf: ['team:manage'] },
  ] },
  { label: 'groupCatalog', items: [
    { label: 'navServices', path: '/catalog/services', anyOf: ['service:manage'] },
    { label: 'navPricing', path: '/catalog/pricing', anyOf: ['pricing:manage'] },
    { label: 'navPromotions', path: '/catalog/promotions', anyOf: ['promotion:manage'] },
  ] },
  { label: 'groupFinance', items: [
    { label: 'navPayments', path: '/finance/payments', anyOf: ['payment:read', 'payment:manage'] },
    { label: 'navCash', path: '/finance/cash', anyOf: ['cash:read'] },
    { label: 'navSettlements', path: '/finance/settlements', anyOf: ['settlement:read', 'settlement:manage'] },
  ] },
  { label: 'groupCommunications', items: [{ label: 'navNotifications', path: '/communications/notifications', anyOf: ['notification:operations:read'] }] },
  { label: 'groupGovernance', items: [
    { label: 'navUsers', path: '/governance/users', anyOf: ['identity:read', 'identity:manage'] },
    { label: 'navAudit', path: '/governance/audit', anyOf: ['audit:read'] },
  ] },
] as const satisfies readonly NavigationGroup[];

export function visibleNavigation(identity: Identity) {
  const permissions = platformPermissions(identity);
  return navigation.map(group => ({ ...group, items: group.items.filter(item => item.anyOf.some(code => permissions.has(code))) }))
    .filter(group => group.items.length > 0);
}

