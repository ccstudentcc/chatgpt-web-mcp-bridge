import type { CatalogContract, CatalogToolDescriptor } from '@cwmb/tool-contracts';
import type { ExecutionProfile, PolicyAction, ToolSource } from '@cwmb/shared-utils';
import type { GatewayConfig } from '../config.js';
import type { LocalTool } from '../tools/index.js';

export const LIVE_CATALOG_VERSION = 'phase1.shared-contract-freeze.v1';

export interface ToolRegistryEntry {
  name: string;
  source: ToolSource;
  schemaId: string;
  tool: LocalTool;
}

export interface MaterializeCatalogOptions {
  includeDisabled?: boolean;
  generatedAt?: Date;
}

export function materializeCatalogToolDescriptor(entry: ToolRegistryEntry): CatalogToolDescriptor {
  return {
    name: entry.name,
    title: entry.tool.title,
    displayName: entry.tool.title,
    description: entry.tool.description,
    source: entry.source,
    risk: entry.tool.risk,
    requiresConfirmation: entry.tool.requiresConfirmation,
    enabled: entry.tool.enabled,
    schemaId: entry.schemaId,
    availability: createAvailability(entry.tool.enabled, entry.tool.requiresConfirmation),
    exampleArgs: entry.tool.exampleArgs
  };
}

export function materializeCatalog(
  entries: readonly ToolRegistryEntry[],
  config: Pick<GatewayConfig, 'workspaceRoot'>,
  options: MaterializeCatalogOptions = {}
): CatalogContract {
  const generatedAt = options.generatedAt ?? new Date();

  return {
    catalogVersion: LIVE_CATALOG_VERSION,
    generatedAt: generatedAt.toISOString(),
    workspaceRoot: config.workspaceRoot,
    tools: materializeCatalogTools(entries, options)
  };
}

export function materializeCatalogTools(
  entries: readonly ToolRegistryEntry[],
  options: Pick<MaterializeCatalogOptions, 'includeDisabled'> = {}
): CatalogToolDescriptor[] {
  const includeDisabled = options.includeDisabled ?? true;
  return entries
    .filter((entry) => includeDisabled || entry.tool.enabled)
    .map(materializeCatalogToolDescriptor);
}

function createAvailability(enabled: boolean, requiresConfirmation: boolean): Partial<Record<ExecutionProfile, PolicyAction>> {
  if (!enabled) {
    return {
      legacy_auto: 'deny',
      reviewed: 'deny',
      yolo: 'deny'
    };
  }

  if (requiresConfirmation) {
    return {
      legacy_auto: 'confirmation_required',
      reviewed: 'confirmation_required',
      yolo: 'execute'
    };
  }

  return {
    legacy_auto: 'execute',
    reviewed: 'execute',
    yolo: 'execute'
  };
}
