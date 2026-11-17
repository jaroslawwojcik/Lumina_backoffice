export const reasonMinLength = 5
export const reasonMaxLength = 500

/** Mirrors the server rule for support reasons (5–500 characters after trimming). Returns a Polish message or `true`. */
export function validateReason(value: string): true | string {
  const length = value.trim().length
  if (length < reasonMinLength) return `Podaj powód (co najmniej ${reasonMinLength} znaków).`
  if (length > reasonMaxLength) return `Powód może mieć najwyżej ${reasonMaxLength} znaków.`
  return true
}
