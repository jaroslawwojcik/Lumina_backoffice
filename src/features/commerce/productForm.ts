import { entitlementKeys, maxAccessDurationDays, minAccessDurationDays, type AdminProduct, type ProductKind, type ProductPayload } from './productApi'

/** Local form state. Kept as strings so RHF can bind inputs; converted to the transport payload by `toProductPayload`. */
export type ProductFormValues = { kind: ProductKind; targetResourceId: string; title: string; description: string; entitlementKey: string; accessDurationDays: string; appleProductId: string; googleProductId: string; isActive: boolean }

export const productDefaults: ProductFormValues = { kind: 'course', targetResourceId: '', title: '', description: '', entitlementKey: 'premium', accessDurationDays: '', appleProductId: '', googleProductId: '', isActive: true }

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
/** RevenueCat reports Google subscriptions as `subscriptionId:basePlanId`. */
export const googleSubscriptionIdPattern = /^[^\s:]+:[^\s:]+$/

export function productToFormValues(product: AdminProduct): ProductFormValues {
  return { kind: product.kind, targetResourceId: product.targetResourceId ?? '', title: product.title, description: product.description ?? '', entitlementKey: product.entitlementKey ?? 'premium', accessDurationDays: product.accessDurationDays?.toString() ?? '', appleProductId: product.appleProductId ?? '', googleProductId: product.googleProductId ?? '', isActive: product.isActive }
}

export function parseAccessDurationDays(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined
  const days = Number(value)
  return days >= minAccessDurationDays && days <= maxAccessDurationDays ? days : undefined
}

function optionalText(value: string): string | undefined { return value.trim() || undefined }
function entitlementKey(value: string): (typeof entitlementKeys)[number] { return entitlementKeys.find((key) => key === value) ?? 'premium' }

/** Maps the form to the transport payload. Store identifiers are dropped for access passes, which are sold only through PayU. */
export function toProductPayload(values: ProductFormValues): ProductPayload {
  const common = { title: values.title.trim(), ...(optionalText(values.description) ? { description: values.description.trim() } : {}) }
  const storeIds = { ...(optionalText(values.appleProductId) ? { appleProductId: values.appleProductId.trim() } : {}), ...(optionalText(values.googleProductId) ? { googleProductId: values.googleProductId.trim() } : {}) }
  if (values.kind === 'course') return { kind: 'course', targetResourceId: values.targetResourceId.trim(), ...common, ...storeIds }
  if (values.kind === 'subscription') return { kind: 'subscription', entitlementKey: entitlementKey(values.entitlementKey), ...common, ...storeIds }
  return { kind: 'access_pass', entitlementKey: entitlementKey(values.entitlementKey), accessDurationDays: parseAccessDurationDays(values.accessDurationDays) ?? 0, ...common }
}
