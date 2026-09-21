import { z } from 'zod'
import { apiFetch } from '../../api/httpClient'

export type ProductListSearch = { search?: string; active?: boolean; pageSize?: 25 | 50 | 100; cursor?: string }

const productListItemSchema = z.object({ productId: z.string().uuid(), targetResourceId: z.string().uuid(), title: z.string(), isActive: z.boolean(), updatedAt: z.string() })
const priceSchema = z.object({ priceId: z.string().uuid(), priceType: z.enum(['standard', 'promotional']), currency: z.literal('PLN'), amountInGrosze: z.number().int().positive(), validFrom: z.string(), validUntil: z.string().nullable(), createdAt: z.string() })
const productDetailSchema = productListItemSchema.extend({ description: z.string().nullable(), appleProductId: z.string().nullable(), googleProductId: z.string().nullable(), createdAt: z.string(), prices: z.array(priceSchema) })
const productListResponseSchema = z.object({ items: z.array(productListItemSchema), nextCursor: z.string().uuid().nullable() })
const productPayloadSchema = z.object({ targetResourceId: z.string().uuid(), title: z.string().trim().min(1), description: z.string().trim().min(1).optional(), appleProductId: z.string().trim().min(1).optional(), googleProductId: z.string().trim().min(1).optional(), isActive: z.boolean().optional() })
const pricePayloadSchema = z.object({ priceType: z.enum(['standard', 'promotional']), amountInGrosze: z.number().int().positive(), validFrom: z.string().datetime({ offset: true }), validUntil: z.string().datetime({ offset: true }).optional() })

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

export async function fetchProducts(search: ProductListSearch, signal?: AbortSignal): Promise<{ items: z.infer<typeof productListItemSchema>[]; nextCursor: string | null }> {
  const response = await apiFetch(`${productPath()}?${queryParams(search).toString()}`, { signal })
  return productListResponseSchema.parse(await response.json())
}

export async function fetchProduct(productId: string, signal?: AbortSignal): Promise<AdminProduct> { const response = await apiFetch(productPath(productId), { signal }); return productDetailSchema.parse(await response.json()) }
export async function createProduct(payload: ProductPayload): Promise<AdminProduct> { const values = productPayloadSchema.parse(payload); const parsed = { ...values, description: values.description ?? null, appleProductId: values.appleProductId ?? null, googleProductId: values.googleProductId ?? null }; const response = await apiFetch(productPath(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) }); return productDetailSchema.parse(await response.json()) }
export async function updateProduct(productId: string, payload: Required<Pick<ProductPayload, 'isActive'>> & ProductPayload): Promise<AdminProduct> { const values = productPayloadSchema.parse(payload); const parsed = { ...values, description: values.description ?? null, appleProductId: values.appleProductId ?? null, googleProductId: values.googleProductId ?? null }; const response = await apiFetch(productPath(productId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) }); return productDetailSchema.parse(await response.json()) }
export async function createProductPrice(productId: string, payload: PricePayload): Promise<AdminProductPrice> { const values = pricePayloadSchema.parse(payload); const parsed = { ...values, validUntil: values.validUntil ?? null }; const response = await apiFetch(`${productPath(productId)}/prices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) }); return priceSchema.parse(await response.json()) }
export async function updateProductPrice(productId: string, priceId: string, payload: PricePayload): Promise<AdminProductPrice> { const values = pricePayloadSchema.parse(payload); const parsed = { ...values, validUntil: values.validUntil ?? null }; const response = await apiFetch(`${productPath(productId)}/prices/${priceId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) }); return priceSchema.parse(await response.json()) }
export async function deleteProductPrice(productId: string, priceId: string): Promise<void> { await apiFetch(`${productPath(productId)}/prices/${priceId}`, { method: 'DELETE' }) }
