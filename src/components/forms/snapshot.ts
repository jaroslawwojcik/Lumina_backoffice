export type FieldDefinition = {
  label: string
  type?: 'number' | 'boolean' | 'text' | 'multiline' | 'object'
  options?: readonly (readonly [string, string])[]
  min?: number
  nullable?: boolean
}

export const snapshotFields: Record<string, FieldDefinition> = {
  publicMetadata: { label: 'Metadane publiczne', type: 'object' },
  title: { label: 'Tytuł' }, summary: { label: 'Krótki opis', type: 'multiline', nullable: true },
  description: { label: 'Opis', type: 'multiline', nullable: true },
  mediaKind: { label: 'Format sesji', options: [['video', 'Wideo'], ['audio', 'Audio']] },
  durationSeconds: { label: 'Czas trwania (sekundy)', type: 'number', min: 1 },
  featured: { label: 'Wyróżniona sesja', type: 'boolean' },
  intensity: { label: 'Intensywność', nullable: true, options: [['low', 'Niska'], ['medium', 'Średnia'], ['high', 'Wysoka']] },
  materialKind: { label: 'Typ materiału', options: [['pdf', 'PDF'], ['audio', 'Audio'], ['video', 'Wideo'], ['image', 'Obraz'], ['document', 'Dokument']] },
  downloadable: { label: 'Można pobrać', type: 'boolean' },
  level: { label: 'Poziom', nullable: true }, estimatedDays: { label: 'Szacowany czas (dni)', type: 'number', min: 1, nullable: true },
  slug: { label: 'Slug' }, locale: { label: 'Język' }, seoTitle: { label: 'Tytuł SEO', nullable: true }, seoDescription: { label: 'Opis SEO', type: 'multiline', nullable: true },
  focusAreas: { label: 'Obszary praktyki' }, intents: { label: 'Cele praktyki' }, equipment: { label: 'Sprzęt' }, style: { label: 'Styl', nullable: true },
  instructorDisplayName: { label: 'Osoba prowadząca', nullable: true },
}

export const sessionPublicMetadataSuggestion: Record<string, unknown> = {
  publicMetadata: {
    style: null,
    intents: [],
    focusAreas: [],
    equipment: [],
    instructorDisplayName: null,
  },
}

export const programPublicMetadataSuggestion: Record<string, unknown> = {
  publicMetadata: {
    intents: [],
    focusAreas: [],
    instructorDisplayName: null,
  },
}

export function parseObject(text: string): Record<string, unknown> | undefined {
  try { const value: unknown = JSON.parse(text); return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined } catch { return undefined }
}

export function fieldError(key: string, value: unknown): string | undefined {
  const definition = snapshotFields[key]
  if (!definition || value === undefined || (value === null && definition.nullable)) return
  if (definition.type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value) ? undefined : 'Wprowadź obiekt.'
  if (['focusAreas', 'intents', 'equipment'].includes(key)) return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim()) ? undefined : 'Podaj listę niepustych wartości tekstowych.'
  if (definition.type === 'number') return typeof value === 'number' && Number.isSafeInteger(value) && value >= (definition.min ?? 0) ? undefined : `Podaj liczbę całkowitą nie mniejszą niż ${definition.min ?? 0}.`
  if (definition.type === 'boolean') return typeof value === 'boolean' ? undefined : 'Wybierz tak lub nie.'
  if (definition.options) return definition.options.some(([option]) => option === value) ? undefined : 'Wybierz wartość z listy.'
  if (typeof value !== 'string') return 'Wprowadź tekst.'
  if (key === 'title' && !value.trim()) return 'Tytuł jest wymagany.'
  if (key === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return 'Użyj małych liter, cyfr i pojedynczych myślników.'
}

export function snapshotErrors(value: Record<string, unknown>): string[] {
  return Object.entries(value).flatMap(([key, item]) => {
    const error = fieldError(key, item)
    if (error) return [`${snapshotFields[key]?.label ?? key}: ${error}`]
    if (Array.isArray(item)) return item.flatMap((entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry) ? snapshotErrors(entry as Record<string, unknown>) : [])
    if (item !== null && typeof item === 'object') return snapshotErrors(item as Record<string, unknown>)
    return []
  })
}
