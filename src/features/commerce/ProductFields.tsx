import { Alert, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material'
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form'
import { ResourcePicker } from '../../components/forms/ResourcePicker'
import { entitlementKeys, maxAccessDurationDays, minAccessDurationDays, productKindLabels, productKinds } from './productApi'
import { googleSubscriptionIdPattern, parseAccessDurationDays, uuidPattern, type ProductFormValues } from './productForm'

const kindDescriptions = {
  course: 'Jednorazowy zakup jednego programu (PayU lub sklep jako produkt nieodnawialny).',
  subscription: 'Subskrypcja Premium sprzedawana wyłącznie przez App Store / Google Play (RevenueCat).',
  access_pass: 'Jednorazowy dostęp Premium na określoną liczbę dni, sprzedawany przez PayU.',
} as const

export function ProductFields({ form, disabled = false, kindLocked = false, includeActive }: { form: UseFormReturn<ProductFormValues>; disabled?: boolean; kindLocked?: boolean; includeActive: boolean }) {
  const kind = useWatch({ control: form.control, name: 'kind' })
  const errors = form.formState.errors
  return <>
    <Controller control={form.control} name="kind" render={({ field }) => <TextField {...field} autoFocus={!kindLocked && !disabled} disabled={disabled || kindLocked} helperText={kindLocked ? 'Rodzaju produktu nie zmienia się po jego utworzeniu.' : kindDescriptions[field.value]} label="Rodzaj produktu" required select>{productKinds.map((value) => <MenuItem key={value} value={value}>{productKindLabels[value]}</MenuItem>)}</TextField>} />
    {kind === 'course' && <Controller control={form.control} name="targetResourceId" rules={{ validate: (value) => form.getValues('kind') !== 'course' || uuidPattern.test(value.trim()) || 'Wybierz program lub podaj poprawny identyfikator UUID.' }} render={({ field, fieldState }) => <ResourcePicker disabled={disabled} error={Boolean(fieldState.error)} helperText={fieldState.error?.message ?? 'Program z poziomem dostępu „Zakup”. Wybierz z listy lub wklej identyfikator UUID.'} label="Program" onBlur={field.onBlur} onChange={field.onChange} programsOnly value={field.value} />} />}
    <TextField disabled={disabled} error={Boolean(errors.title)} helperText={errors.title?.message} label="Tytuł" {...form.register('title', { validate: (value) => value.trim().length > 0 || 'Tytuł jest wymagany.' })} required />
    <TextField disabled={disabled} label="Opis (opcjonalnie)" minRows={3} multiline {...form.register('description')} />
    {kind !== 'course' && <Controller control={form.control} name="entitlementKey" render={({ field }) => <TextField {...field} disabled={disabled} helperText="Uprawnienie nadawane po zakupie. Musi odpowiadać uprawnieniu w RevenueCat." label="Klucz uprawnienia" required select>{entitlementKeys.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>} />}
    {kind === 'access_pass' && <TextField disabled={disabled} error={Boolean(errors.accessDurationDays)} helperText={errors.accessDurationDays?.message ?? `Od ${minAccessDurationDays} do ${maxAccessDurationDays} dni, np. 30 lub 365.`} label="Długość dostępu (dni)" slotProps={{ htmlInput: { inputMode: 'numeric', min: minAccessDurationDays, max: maxAccessDurationDays } }} type="number" {...form.register('accessDurationDays', { validate: (value) => form.getValues('kind') !== 'access_pass' || parseAccessDurationDays(value) !== undefined || `Podaj liczbę dni od ${minAccessDurationDays} do ${maxAccessDurationDays}.` })} required />}
    {kind !== 'access_pass' && <>
      <TextField disabled={disabled} helperText="Identyfikator produktu z App Store Connect." label="Apple product ID (opcjonalnie)" {...form.register('appleProductId')} />
      <TextField disabled={disabled} error={Boolean(errors.googleProductId)} helperText={errors.googleProductId?.message ?? (kind === 'subscription' ? 'Dla subskrypcji użyj formatu subscriptionId:basePlanId — dokładnie tak, jak RevenueCat raportuje product_id.' : 'Identyfikator produktu z Google Play Console.')} label="Google product ID (opcjonalnie)" {...form.register('googleProductId', { validate: (value) => form.getValues('kind') !== 'subscription' || !value.trim() || googleSubscriptionIdPattern.test(value.trim()) || 'Użyj formatu subscriptionId:basePlanId.' })} />
    </>}
    {kind === 'subscription' && <Alert severity="info">Subskrypcja nie jest sprzedawana przez PayU. Bez identyfikatora Apple lub Google nie będzie dostępna w aplikacji.</Alert>}
    {kind === 'access_pass' && <Alert severity="info">Karnet jest sprzedawany tylko przez PayU, dlatego identyfikatory sklepów nie są zapisywane.</Alert>}
    {includeActive && <Controller control={form.control} name="isActive" render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} disabled={disabled} onChange={(event) => field.onChange(event.target.checked)} />} label="Produkt aktywny" />} />}
  </>
}
