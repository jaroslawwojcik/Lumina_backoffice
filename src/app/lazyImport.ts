const reloadPrefix = 'lumina:lazy-reload:'

export function isDynamicImportFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed|ChunkLoadError/i.test(message)
}

export async function importWithReload<T>(
  loader: () => Promise<T>,
  moduleName: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.sessionStorage,
  reload: () => void = () => window.location.reload(),
): Promise<T> {
  const key = `${reloadPrefix}${moduleName}`
  try {
    const loaded = await loader()
    storage.removeItem(key)
    return loaded
  } catch (error) {
    if (!isDynamicImportFailure(error) || storage.getItem(key) === 'attempted') throw error
    storage.setItem(key, 'attempted')
    reload()
    return new Promise<T>(() => undefined)
  }
}
