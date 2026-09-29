const fields: Record<string, string> = { canonicalKey: 'klucz treści', slug: 'adres treści', title: 'tytuł', durationSeconds: 'czas trwania', mediaKind: 'format nagrania', accessTier: 'zasady dostępu', primaryAssetId: 'główne nagranie', thumbnailAssetId: 'miniatura', sections: 'sekcje programu' }
export const fieldLabel = (field: string) => fields[field] ?? 'uzupełnienie propozycji'
