import { useWatch, type Control, type FieldValues } from 'react-hook-form'
import { JsonPreview } from './JsonPreview'

export function FormJsonPreview<T extends FieldValues>({ control, project }: { control: Control<T>; project?: (values: T) => unknown }) {
  const values = useWatch({ control }) as T
  return <JsonPreview label="Podgląd danych formularza (JSON)" value={project ? project(values) : values} />
}
