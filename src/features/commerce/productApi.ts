import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

export type ProductListSearch = { search?: string; active?: boolean; pageSize?: 25 | 50 | 100; cursor?: string }

export const productKinds = ['course', 'subscription', 'access_pass'] as const
export type ProductKind = (typeof productKinds)[number]
export const productKindLabels: Record<ProductKind, string> = { course: 'Kurs', subscription: 'Subskrypcja', access_pass: 'Karnet dostępu' }
/** Entitlement keys accepted by the contract. Only `premium` exists today. */
export const entitlementKeys = ['premium'] as const
export const minAccessDurationDays = 1
export const maxAccessDurationDays = 366

const productKindSchema = z.enum(productKinds)
// `kind`, `entitlementKey` and `accessDurationDays` are additive; products created before monetization migrate to `course`.
const productListItemSchema = z.object({ productId: z.string().uuid(), kind: productKindSchema.default('course'), targetResourceId: z.string().uuid().nullable(), title: z.string(), isActive: z.boolean(), updatedAt: z.string() })
const priceSchema = z.object({ priceId: z.string().uuid(), priceType: z.enum(['standard', 'promotional']), currency: z.literal('PLN'), amountInGrosze: z.number().int().positive(), validFrom: z.string(), validUntil: z.string().nullable(), createdAt: z.string() })
const productDetailSchema = productListItemSchema.extend({ entitlementKey: z.string().nullable().default(null), accessDurationDays: z.number().int().nullable().default(null), description: z.string().nullable(), appleProductId: z.string().nullable(), googleProductId: z.string().nullable(), createdAt: z.string(), prices: z.array(priceSchema) })
const productListResponseSchema = z.object({ items: z.array(productListItemSchema), nextCursor: z.string().uuid().nullable() })
const productPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('course'), targetResourceId: z.string().uuid() }),
  z.object({ kind: z.literal('subscription'), entitlementKey: z.enum(entitlementKeys) }),
  z.object({ kind: z.literal('access_pass'), entitlementKey: z.enum(entitlementKeys), accessDurationDays: z.number().int().min(minAccessDurationDays).max(maxAccessDurationDays) }),
]).and(z.object({ title: z.string().trim().min(1), description: z.string().trim().min(1).optional(), appleProductId: z.string().trim().min(1).optional(), googleProductId: z.string().trim().min(1).optional(), isActive: z.boolean().optional() }))
const pricePayloadSchema = z.object({ priceType: z.enum(['standard', 'promotional']), amountInGrosze: z.number().int().positive(), validFrom: z.string().datetime({ offset: true }), validUntil: z.string().datetime({ offset: true }).optional() })

export type AdminProductListItem = z.infer<typeof productListItemSchema>
export type AdminProduct = z.infer<typeof productDetailSchema>
export type AdminProductPrice = z.infer<typeof priceSchema>
export type ProductPayload = z.infer<typeof productPayloadSchema>
export type PricePayload = z.infer<typeof pricePayloadSchema>
function queryParams(search: ProductListSearch): URLSearchParams { const params = new URLSearchParams(); if (search.search) params.set('search', search.search); if (search.active !== undefined) params.set('active', String(search.active)); if (search.pageSize) params.set('pageSize', String(search.pageSize)); if (search.cursor) params.set('cursor', search.cursor); return params }
function productPath(productId?: string): string { return `/api/v1/admin/products${productId ? `/${productId}` : ''}` }

export function parsePlnToGrosze(value: string): number | undefined {
  const match = /^(0|[1-9]\d*)(?:,(\d{1,2}))?$/.exec(value.trim())
  if (!match) return undefined
  const grosze = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(grosze) && grosze > 0 && grosze <= 2_147_483_647 ? grosze : undefined
}

export function formatGroszeAsPln(amountInGrosze: number): string { return `${Math.floor(amountInGrosze / 100)},${String(amountInGrosze % 100).padStart(2, '0')} zł` }
export function utcInputToIso(value: string): string | undefined { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00Z` : undefined }
export function isoToUtcInput(value: string): string { return value.slice(0, 16) }

export async function fetchProducts(search: ProductListSearch, signal?: AbortSignal): Promise<{ items: AdminProductListItem[]; nextCursor: string | null }> {
  const response = await apiFetch(`${productPath()}?${queryParams(search).toString()}`, { signal })
  return productListResponseSchema.parse(await response.json())
}

/** Builds the explicit wire body: every kind-specific field is sent, with `null` where it does not apply to the kind. */
function toProductRequestBody(payload: ProductPayload) {
  const values = productPayloadSchema.parse(payload)
  return {
    kind: values.kind,
    targetResourceId: values.kind === 'course' ? values.targetResourceId : null,
    entitlementKey: values.kind === 'course' ? null : values.entitlementKey,
    accessDurationDays: values.kind === 'access_pass' ? values.accessDurationDays : null,
    title: values.title,
    description: values.description ?? null,
    appleProductId: values.appleProductId ?? null,
    googleProductId: values.googleProductId ?? null,
    ...(values.isActive === undefined ? {} : { isActive: values.isActive }),
  }
}

export async function fetchProduct(productId: string, signal?: AbortSignal): Promise<AdminProduct> { const response = await apiFetch(productPath(productId), { signal }); return productDetailSchema.parse(await response.json()) }
export async function createProduct(payload: ProductPayload): Promise<AdminProduct> { const response = await apiFetch(productPath(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toProductRequestBody(payload)) }); return productDetailSchema.parse(await response.json()) }
export async function updateProduct(productId: string, payload: ProductPayload & { isActive: boolean }): Promise<AdminProduct> { const response = await apiFetch(productPath(productId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toProductRequestBody(payload)) }); return productDetailSchema.parse(await response.json()) }
export async function createProductPrice(productId: string, payload: PricePayload): Promise<AdminProductPrice> { const values = pricePayloadSchema.parse(payload); const parsed = { ...values, validUntil: values.validUntil ?? null }; const response = await apiFetch(`${productPath(productId)}/prices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) }); return priceSchema.parse(await response.json()) }
export async function updateProductPrice(productId: string, priceId: string, payload: PricePayload): Promise<AdminProductPrice> { const values = pricePayloadSchema.parse(payload); const parsed = { ...values, validUntil: values.validUntil ?? null }; const response = await apiFetch(`${productPath(productId)}/prices/${priceId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) }); return priceSchema.parse(await response.json()) }
export async function deleteProductPrice(productId: string, priceId: string): Promise<void> { await apiFetch(`${productPath(productId)}/prices/${priceId}`, { method: 'DELETE' }) }
