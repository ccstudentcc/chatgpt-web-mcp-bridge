import type {
  CatalogContract,
  CatalogSource,
  GatewayHealthContract,
  GatewayRuntimeSnapshot
} from '@cwmb/protocol';

export function hasLiveGatewayCatalog(snapshot: GatewayRuntimeSnapshot | undefined): boolean {
  return snapshot?.catalogSource === 'live' && snapshot.catalog !== undefined;
}

export function getGatewayCatalog(snapshot: GatewayRuntimeSnapshot | undefined): CatalogContract | undefined {
  return snapshot?.catalog;
}

export function getGatewayCatalogTools(snapshot: GatewayRuntimeSnapshot | undefined): CatalogContract['tools'] {
  return snapshot?.catalog?.tools ?? [];
}

export function withGatewayHealth(
  snapshot: GatewayRuntimeSnapshot | undefined,
  health: GatewayHealthContract
): GatewayRuntimeSnapshot {
  return {
    ...snapshot,
    health
  };
}

export function withGatewayCatalog(
  snapshot: GatewayRuntimeSnapshot | undefined,
  catalog: CatalogContract,
  source: CatalogSource
): GatewayRuntimeSnapshot {
  return {
    ...snapshot,
    catalog,
    catalogSource: source
  };
}

export function withoutGatewayCatalog(
  snapshot: GatewayRuntimeSnapshot | undefined
): GatewayRuntimeSnapshot | undefined {
  if (!snapshot?.health) {
    return undefined;
  }

  return {
    health: snapshot.health
  };
}
