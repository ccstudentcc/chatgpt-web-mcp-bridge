import type { RiskLevel } from '@cwmb/shared-utils';
import type { ToolDescriptor } from '@cwmb/tool-contracts';

export interface PendingToolBlockLike {
  block: {
    tool: string;
    args: Record<string, unknown>;
  };
}

export type CapabilityState = 'enabled' | 'disabled' | 'unsupported' | 'catalog_unavailable';

export interface PendingCapabilityItem<TBlock extends PendingToolBlockLike = PendingToolBlockLike> {
  block: TBlock;
  descriptor?: ToolDescriptor;
  state: CapabilityState;
  reason?: string;
}

export interface PendingCapabilityAssessment<TBlock extends PendingToolBlockLike = PendingToolBlockLike> {
  runnable: boolean;
  autoRunnable: boolean;
  highestRisk?: RiskLevel;
  blockedReason?: string;
  autoBlockedReason?: string;
  items: PendingCapabilityItem<TBlock>[];
}

const riskWeight: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

export function assessPendingTools<TBlock extends PendingToolBlockLike>(
  blocks: TBlock[],
  tools: ToolDescriptor[],
  catalogLoaded: boolean
): PendingCapabilityAssessment<TBlock> {
  if (blocks.length === 0) {
    return { runnable: false, autoRunnable: false, items: [] };
  }

  if (!catalogLoaded) {
    return {
      runnable: false,
      autoRunnable: false,
      blockedReason: 'Tool catalog unavailable. Refresh gateway capabilities.',
      items: blocks.map((block) => ({
        block,
        state: 'catalog_unavailable',
        reason: 'Tool catalog unavailable.'
      }))
    };
  }

  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  const items = blocks.map<PendingCapabilityItem<TBlock>>((block) => {
    const descriptor = toolsByName.get(block.block.tool);
    if (!descriptor) {
      return {
        block,
        state: 'unsupported',
        reason: 'Tool is not exposed by the current gateway.'
      };
    }

    if (!descriptor.enabled) {
      return {
        block,
        descriptor,
        state: 'disabled',
        reason: 'Tool exists but is currently disabled by the gateway.'
      };
    }

    return {
      block,
      descriptor,
      state: 'enabled'
    };
  });

  const blocked = items.find((item) => item.state !== 'enabled');
  const enabledDescriptors = items.flatMap((item) => (item.descriptor ? [item.descriptor] : []));
  const autoBlocked = enabledDescriptors.find((descriptor) => descriptor.risk !== 'low' || descriptor.requiresConfirmation);

  return {
    runnable: !blocked,
    autoRunnable: !blocked && !autoBlocked,
    highestRisk: enabledDescriptors.reduce<RiskLevel | undefined>((current, descriptor) => {
      if (!current || riskWeight[descriptor.risk] > riskWeight[current]) {
        return descriptor.risk;
      }
      return current;
    }, undefined),
    blockedReason: blocked?.reason,
    autoBlockedReason: autoBlocked
      ? 'High-risk or confirmation-required tools must be run manually.'
      : undefined,
    items
  };
}

export function formatCapabilityLabel(item: PendingCapabilityItem): string {
  switch (item.state) {
    case 'enabled':
      return 'enabled';
    case 'disabled':
      return 'disabled';
    case 'unsupported':
      return 'unsupported';
    case 'catalog_unavailable':
      return 'catalog unavailable';
  }
}
