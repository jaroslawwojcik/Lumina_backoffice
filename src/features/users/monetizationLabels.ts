import type { UserEntitlements } from './userApi'
import { formatDate } from './userFormat'

/** Polish labels for monetization enums. Unknown values fall back to the raw server value so new states stay visible. */
export function labelFor(labels: Readonly<Record<string, string>>, value: string): string { return labels[value] ?? value }

export const orderStatusLabels: Readonly<Record<string, string>> = { pending: 'Oczekuje', waiting_for_confirmation: 'Oczekuje na potwierdzenie', completed: 'Opłacone', cancelled: 'Anulowane', failed: 'Nieudane', refund_pending: 'Zwrot w toku', refunded: 'Zwrócone' }
export const subscriptionStatusLabels: Readonly<Record<string, string>> = { active: 'Aktywna', grace_period: 'Okres karencji', billing_issue: 'Problem z płatnością', cancelled: 'Anulowana (aktywna do końca okresu)', expired: 'Wygasła', refunded: 'Zwrócona', paused: 'Wstrzymana' }
export const storeLabels: Readonly<Record<string, string>> = { app_store: 'App Store', play_store: 'Google Play', payu: 'PayU', manual: 'Ręcznie' }
export const providerLabels: Readonly<Record<string, string>> = { revenuecat: 'RevenueCat', payu: 'PayU', support: 'Wsparcie', test: 'Test' }
export const commerceEnvironmentLabels: Readonly<Record<string, string>> = { production: 'Produkcja', sandbox: 'Sandbox' }
export const transactionTypeLabels: Readonly<Record<string, string>> = { purchase: 'Zakup', renewal: 'Odnowienie', refund: 'Zwrot', cancellation: 'Anulowanie', expiration: 'Wygaśnięcie', billing_issue: 'Problem z płatnością', product_change: 'Zmiana produktu', transfer_in: 'Przeniesienie (przychodzące)', transfer_out: 'Przeniesienie (wychodzące)', grant: 'Nadanie', revoke: 'Odebranie' }
export const grantScopeLabels: Readonly<Record<string, string>> = { entitlement: 'Uprawnienie', resource: 'Zasób' }

export function subscriptionStatusColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'active') return 'success'
  if (status === 'grace_period' || status === 'billing_issue' || status === 'cancelled' || status === 'paused') return 'warning'
  if (status === 'refunded') return 'error'
  return 'default'
}

export function describeEntitlements(entitlements: UserEntitlements): string {
  const premium = entitlements.premium
  const premiumText = premium
    ? `Premium ${premium.isActive ? 'aktywne' : 'nieaktywne'}${premium.validUntil ? ` do ${formatDate(premium.validUntil)}` : ''} (${labelFor(subscriptionStatusLabels, premium.status)}${premium.store ? `, ${labelFor(storeLabels, premium.store)}` : ''}).`
    : 'Brak Premium.'
  return `${premiumText} Kursy z dostępem: ${entitlements.courses.length}.`
}
