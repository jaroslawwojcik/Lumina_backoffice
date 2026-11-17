import { ApiError } from '../../api/apiError'
import { labelFor, orderStatusLabels } from './monetizationLabels'
import type { AdminUserOrder } from './userApi'

/** Completed PayU orders can be refunded; refund_pending ones can repeat the idempotent refund (left pending after a PayU 503). Full refund only. */
export function canRefundOrder(order: Pick<AdminUserOrder, 'provider' | 'status'>): boolean {
  return order.provider === 'payu' && (order.status === 'completed' || order.status === 'refund_pending')
}

/** True when the refund was already requested, so the action repeats it instead of starting a new one. */
export function isRefundRepeat(order: Pick<AdminUserOrder, 'status'>): boolean {
  return order.status === 'refund_pending'
}

/**
 * Polish message for `POST /admin/orders/{orderId}/refund` failures (server `detail` is English, so it is not shown).
 * 400 invalid reason, 404 unknown order, 409 not refundable or rejected by PayU, 503 PayU unavailable (retry is idempotent).
 */
export function refundErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Nie udało się zlecić zwrotu. Stan zamówienia jest nieznany — odśwież listę przed ponowną próbą.'
  switch (error.status) {
    case 400: return 'Zwrot odrzucony: sprawdź powód (5–500 znaków).'
    case 404: return 'Nie znaleziono zamówienia. Odśwież listę zamówień.'
    case 409: return 'Tego zamówienia nie można zwrócić — nie jest opłacone przez PayU albo PayU odrzuciło zwrot. Odśwież listę, aby sprawdzić aktualny status.'
    case 503: return 'PayU jest chwilowo niedostępne. Zwrot pozostaje w toku, a ponowienie jest bezpieczne — spróbuj ponownie za chwilę.'
    case undefined: return `${error.message} Stan zamówienia jest nieznany — odśwież listę przed ponowną próbą.`
    default: return error.message
  }
}

/** Success feedback depends on the order state returned with the 202. */
export function refundSuccessMessage(order: Pick<AdminUserOrder, 'productTitle' | 'status'>): string {
  const title = `„${order.productTitle}”`
  if (order.status === 'refunded') return `Zamówienie ${title} zostało już zwrócone.`
  if (order.status === 'completed') return `PayU anulowało zwrot zamówienia ${title}. Zamówienie pozostaje opłacone.`
  return `Zlecono zwrot zamówienia ${title}. Status: ${labelFor(orderStatusLabels, order.status)}. Dostęp zostanie odebrany po potwierdzeniu zwrotu przez PayU.`
}
