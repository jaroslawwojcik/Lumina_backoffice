import { describe, expect, it, vi } from 'vitest'
import { importWithReload, isDynamicImportFailure } from './lazyImport'

describe('lazy module recovery', () => {
  it('reloads once when a deployment removed an old dynamic chunk', async () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const reload = vi.fn()
    void importWithReload(
      () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/old.js')),
      'release-composer',
      storage,
      reload,
    )

    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
    expect(values.get('lumina:lazy-reload:release-composer')).toBe('attempted')
  })

  it('does not classify ordinary rendering errors as stale chunks', () => {
    expect(isDynamicImportFailure(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})
