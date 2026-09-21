import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SnapshotEditor } from './SnapshotEditor'
import { parseObject, snapshotErrors } from './snapshot'

function Editor({ initial }: { initial: Record<string, unknown> }) {
  const [value, setValue] = useState(JSON.stringify(initial))
  return <SnapshotEditor label="JSON" value={value} onChange={setValue} />
}

describe('SnapshotEditor', () => {
  it('synchronizes fields and JSON in both directions while preserving unknown nested data', () => {
    render(<Editor initial={{ durationSeconds: 600, featured: false, custom: { providerKey: 'keep-me' } }} />)
    fireEvent.change(screen.getByLabelText('Czas trwania (sekundy)'), { target: { value: '900' } })
    expect(JSON.parse((screen.getByLabelText('JSON') as HTMLTextAreaElement).value)).toEqual({ durationSeconds: 900, featured: false, custom: { providerKey: 'keep-me' } })
    fireEvent.change(screen.getByLabelText('JSON'), { target: { value: '{"durationSeconds":1200,"featured":true,"custom":{"providerKey":"unchanged"}}' } })
    expect(screen.getByLabelText('Czas trwania (sekundy)')).toHaveValue(1200)
    expect(screen.getByLabelText('Wyróżniona sesja')).toBeChecked()
    expect(screen.getByLabelText('custom / providerKey')).toHaveValue('unchanged')
  })

  it('preserves malformed JSON until corrected and shows field-level numeric errors', () => {
    render(<Editor initial={{ durationSeconds: 600 }} />)
    fireEvent.change(screen.getByLabelText('Czas trwania (sekundy)'), { target: { value: '-1' } })
    expect(screen.getByLabelText('Czas trwania (sekundy)')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(screen.getByLabelText('JSON'), { target: { value: '{"durationSeconds":' } })
    expect(screen.getByLabelText('JSON')).toHaveValue('{"durationSeconds":')
    expect(screen.queryByLabelText('Czas trwania (sekundy)')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('JSON'), { target: { value: '{"durationSeconds":10}' } })
    expect(screen.getByLabelText('Czas trwania (sekundy)')).toHaveValue(10)
  })

  it('edits arrays without flattening their JSON structure', () => {
    render(<Editor initial={{ intents: ['sleep'], custom: { items: [1, 2] } }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj pozycję: Cele praktyki' }))
    fireEvent.change(screen.getByLabelText('Cele praktyki 2'), { target: { value: 'relaxation' } })
    const value = JSON.parse((screen.getByLabelText('JSON') as HTMLTextAreaElement).value)
    expect(value).toEqual({ intents: ['sleep', 'relaxation'], custom: { items: [1, 2] } })
    expect(snapshotErrors(value)).toEqual([])
  })

  it('rejects incorrect types, fractional durations and array roots', () => {
    expect(parseObject('[]')).toBeUndefined()
    expect(parseObject('null')).toBeUndefined()
    expect(snapshotErrors({ durationSeconds: 1.5, featured: 'false', intensity: 'extreme' })).toHaveLength(3)
    expect(snapshotErrors({ estimatedDays: null, intensity: null, downloadable: false })).toEqual([])
  })
})

