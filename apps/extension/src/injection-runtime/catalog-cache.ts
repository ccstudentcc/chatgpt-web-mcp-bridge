import { CatalogContractSchema, type CatalogContract } from '@cwmb/protocol';

const TOOL_CATALOG_CACHE_KEY = 'cwmb_tool_catalog_cache';

export function readStoredToolCatalog(): CatalogContract | null {
  const raw = GM_getValue(TOOL_CATALOG_CACHE_KEY, '');
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const catalog = CatalogContractSchema.safeParse(parsed);
    if (catalog.success) {
      return catalog.data;
    }

    if (Array.isArray(parsed)) {
      const wrapped = CatalogContractSchema.safeParse({
        catalogVersion: 'legacy-userscript-cache',
        generatedAt: '1970-01-01T00:00:00.000Z',
        tools: parsed
      });
      return wrapped.success ? wrapped.data : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function writeStoredToolCatalog(catalog: CatalogContract): void {
  GM_setValue(TOOL_CATALOG_CACHE_KEY, JSON.stringify(catalog));
}
