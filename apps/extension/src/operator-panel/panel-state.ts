import type { CatalogSource, GatewayRuntimeSnapshot, ToolDescriptor } from '@cwmb/tool-contracts';
import type { RequestHookStatus, RequestInjectionMode } from '../injection-runtime/index.js';
import {
  deriveDeliveryPanelState,
  getDeliveryPanelCopy,
  getDeliveryStatusLabel,
  getDeliveryStatusTone,
  summarizePendingBlock,
  type DeliveryBridgeStatus,
  type DeliveryPanelCopy,
  type DeliveryStatusTone
} from '../result-delivery/index.js';
import { assessPendingTools, formatCapabilityLabel, type PendingToolBlockLike } from './capabilities.js';

export interface OperatorPanelButtonView {
  action: string;
  label: string;
  tone: 'default' | 'primary' | 'danger' | 'ghost';
}

export interface OperatorPanelToggleView {
  action: string;
  label: string;
  enabled: boolean;
}

export interface OperatorPanelStatView {
  label: string;
  value: string;
}

export interface OperatorPanelNoticeView {
  tone: 'muted' | 'info' | 'warn' | 'danger';
  message: string;
}

export interface OperatorPanelPendingItemView {
  capabilityLabel: string;
  raw: string;
  summary: string;
  tool: string;
}

export interface OperatorPanelRequestHookView {
  status: RequestHookStatus;
  transport?: string;
  source?: CatalogSource;
  catalogVersion?: string;
}

export interface OperatorPanelDeliveryRecoveryView {
  kind?: 'clipboard_fallback' | 'send_button_missing' | 'submission_not_confirmed';
  message?: string;
}

export interface OperatorPanelProgressView {
  current: number;
  total: number;
  tool: string;
}

export interface OperatorPanelLogView {
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
  timestamp: string;
}

export interface OperatorPanelBatchLike<TBlock extends PendingToolBlockLike = PendingToolBlockLike> {
  blocks: TBlock[];
  batchId: string;
  messageId: string;
}

export interface OperatorPanelViewInput<TBlock extends PendingToolBlockLike = PendingToolBlockLike> {
  autoExecuteEnabled: boolean;
  autoInsertResult: boolean;
  autoSendResult: boolean;
  baseUrl: string;
  catalogTools: ToolDescriptor[];
  continueBatchOnError: boolean;
  gatewayRuntime?: GatewayRuntimeSnapshot;
  hasLiveCatalog: boolean;
  lastDeliveryRecovery?: OperatorPanelDeliveryRecoveryView;
  lastError?: string;
  lastRequestHook?: OperatorPanelRequestHookView;
  lastResult?: string;
  logs: OperatorPanelLogView[];
  panelCollapsed: boolean;
  pending: TBlock[];
  pendingBatchId?: string;
  progress?: OperatorPanelProgressView;
  requestInjectionMode: RequestInjectionMode;
  requestPromptCatalogVersion?: string;
  requestPromptSource?: CatalogSource;
  retryableBatch?: OperatorPanelBatchLike<TBlock>;
  status: DeliveryBridgeStatus;
  token: string;
  trustedLocalMode: boolean;
}

export interface OperatorPanelViewState {
  automationNotice?: OperatorPanelNoticeView;
  collapsedActions: OperatorPanelButtonView[];
  collapsedSummary: string;
  configActions: OperatorPanelButtonView[];
  copyJsonPayload?: string;
  copyResultPayload?: string;
  deliveryCopy: DeliveryPanelCopy;
  detectionListItems: OperatorPanelPendingItemView[];
  detectionMode: 'empty' | 'single_pending' | 'batch_pending' | 'retryable_batch';
  detectionText: string;
  detailItems: OperatorPanelPendingItemView[];
  errorNotice?: OperatorPanelNoticeView;
  headerButtonLabel: string;
  intentActions: OperatorPanelButtonView[];
  latestLogMessage?: string;
  logEntries: OperatorPanelLogView[];
  manualRunNotice?: OperatorPanelNoticeView;
  pendingDisclosureLabel: string;
  progressNotice?: OperatorPanelNoticeView;
  recoveryNotice?: OperatorPanelNoticeView;
  resultDisclosureLabel: string;
  resultEmptyState: string;
  resultPayload?: string;
  runtimeStats: OperatorPanelStatView[];
  statusLabel: string;
  statusTone: DeliveryStatusTone;
  toggles: OperatorPanelToggleView[];
  capabilityNotice?: OperatorPanelNoticeView;
}

export function deriveOperatorPanelViewState<TBlock extends PendingToolBlockLike>(
  input: OperatorPanelViewInput<TBlock>
): OperatorPanelViewState {
  const deliveryPanel = deriveDeliveryPanelState({
    status: input.status,
    lastResult: input.lastResult,
    pending: input.pending,
    pendingBatchId: input.pendingBatchId,
    retryableBatch: input.retryableBatch
  });
  const capability = assessPendingTools(deliveryPanel.activeBlocks, input.catalogTools, input.hasLiveCatalog);
  const canRunPending = input.pending.length > 0 && capability.runnable;
  const canRetryBatch = deliveryPanel.hasRetryableBatch && capability.runnable;
  const canInsertResult = deliveryPanel.canInsertResult;
  const isManualRunRequired = input.autoExecuteEnabled && capability.runnable && !capability.autoRunnable;
  const deliveryCopy = getDeliveryPanelCopy({
    activeCount: deliveryPanel.activeBlocks.length,
    hasRetryableBatch: deliveryPanel.hasRetryableBatch,
    canInsertResult,
    hasError: Boolean(input.lastError),
    recoveryKind: input.lastDeliveryRecovery?.kind,
    recoveryMessage: input.lastDeliveryRecovery?.message
  });
  const detectionItems = toPendingItems(
    deliveryPanel.isPendingBatch || deliveryPanel.hasRetryableBatch
      ? deliveryPanel.visibleBatch
      : [],
    capability
  );
  const detailItems = toPendingItems(deliveryPanel.activeBlocks, capability);
  const detectionMode = input.pending[0]
    ? deliveryPanel.isPendingBatch
      ? 'batch_pending'
      : 'single_pending'
    : deliveryPanel.hasRetryableBatch
      ? 'retryable_batch'
      : 'empty';
  const configActions: OperatorPanelButtonView[] = [];
  if (!input.trustedLocalMode) {
    configActions.push({ action: 'token', label: 'Set token', tone: 'ghost' });
  }
  configActions.push({ action: 'base-url', label: 'Gateway URL', tone: 'ghost' });
  if (input.hasLiveCatalog && input.catalogTools.length > 0) {
    configActions.push({ action: 'insert-catalog', label: 'Insert MCP list', tone: 'ghost' });
    configActions.push({ action: 'copy-catalog', label: 'Copy MCP list', tone: 'ghost' });
  }

  const intentActions: OperatorPanelButtonView[] = [];
  const collapsedActions: OperatorPanelButtonView[] = [];
  if (input.pending[0]) {
    if ((!input.autoExecuteEnabled && canRunPending) || isManualRunRequired) {
      const runLabel = deliveryPanel.isPendingBatch ? 'Run all' : 'Run';
      intentActions.push({ action: 'run', label: runLabel, tone: 'primary' });
      collapsedActions.push({ action: 'run', label: runLabel, tone: 'primary' });
    }
    const ignoreLabel = deliveryPanel.isPendingBatch ? 'Ignore batch' : 'Ignore';
    intentActions.push({ action: 'ignore', label: ignoreLabel, tone: 'danger' });
    intentActions.push({
      action: 'copy-json',
      label: deliveryPanel.isPendingBatch ? 'Copy first JSON' : 'Copy JSON',
      tone: 'ghost'
    });
    collapsedActions.push({ action: 'ignore', label: ignoreLabel, tone: 'danger' });
  } else if (canRetryBatch) {
    intentActions.push({ action: 'retry-batch', label: deliveryCopy.retryBatchLabel, tone: 'primary' });
    collapsedActions.push({ action: 'retry-batch', label: deliveryCopy.retryBatchLabel, tone: 'primary' });
  }

  if (canInsertResult) {
    intentActions.push({ action: 'insert-result', label: deliveryCopy.insertResultLabel, tone: 'primary' });
    collapsedActions.push({ action: 'insert-result', label: deliveryCopy.insertResultLabel, tone: 'primary' });
  }
  if (input.lastResult) {
    intentActions.push({ action: 'copy-result', label: deliveryCopy.copyResultLabel, tone: 'ghost' });
  }

  return {
    automationNotice: deriveAutomationNotice(input),
    collapsedActions,
    collapsedSummary: deliveryCopy.collapsedSummary,
    configActions,
    copyJsonPayload: getRawPayload(input.pending[0]),
    copyResultPayload: input.lastResult,
    deliveryCopy,
    detectionListItems: detectionItems,
    detectionMode,
    detectionText: getDetectionText(input.pending, deliveryPanel.visibleBatch.length, detectionMode),
    detailItems,
    errorNotice: input.lastError ? { tone: 'danger', message: input.lastError } : undefined,
    headerButtonLabel: input.panelCollapsed ? 'Expand' : 'Collapse',
    intentActions,
    latestLogMessage: input.logs[input.logs.length - 1]?.message,
    logEntries: [...input.logs].reverse(),
    manualRunNotice: isManualRunRequired && capability.autoBlockedReason
      ? { tone: 'info', message: capability.autoBlockedReason }
      : undefined,
    pendingDisclosureLabel: deliveryCopy.pendingDisclosureLabel,
    progressNotice: input.progress
      ? {
        tone: 'info',
        message: `Running ${input.progress.current}/${input.progress.total}: ${input.progress.tool}`
      }
      : undefined,
    recoveryNotice: deliveryCopy.recoveryCallout
      ? { tone: 'warn', message: deliveryCopy.recoveryCallout }
      : undefined,
    resultDisclosureLabel: deliveryCopy.resultDisclosureLabel,
    resultEmptyState: deliveryCopy.resultEmptyState,
    resultPayload: input.lastResult,
    runtimeStats: buildRuntimeStats(input, capability.highestRisk),
    statusLabel: getDeliveryStatusLabel(input.status),
    statusTone: getDeliveryStatusTone(input.status),
    toggles: [
      { action: 'toggle-execute', label: 'Execute', enabled: input.autoExecuteEnabled },
      { action: 'toggle-insert', label: 'Insert', enabled: input.autoInsertResult },
      { action: 'toggle-send', label: 'Send', enabled: input.autoSendResult },
      { action: 'toggle-continue-batch', label: 'Continue on error', enabled: input.continueBatchOnError }
    ],
    capabilityNotice: capability.blockedReason
      ? { tone: 'danger', message: capability.blockedReason }
      : undefined
  };
}

function buildRuntimeStats<TBlock extends PendingToolBlockLike>(
  input: OperatorPanelViewInput<TBlock>,
  highestRisk?: string
): OperatorPanelStatView[] {
  const runtimeSnapshot = input.gatewayRuntime;
  const displayCatalog = runtimeSnapshot?.catalog;
  const enabledTools = displayCatalog?.tools.filter((tool) => tool.enabled).length ?? 0;
  const totalTools = displayCatalog?.tools.length ?? 0;
  const injection = deriveInjectionSummary(input);

  return [
    { label: 'Gateway', value: input.baseUrl },
    {
      label: 'Catalog',
      value: displayCatalog ? `${enabledTools} / ${totalTools}` : 'Unavailable'
    },
    {
      label: 'Catalog ver',
      value: displayCatalog?.catalogVersion ?? 'Unavailable'
    },
    {
      label: 'Catalog src',
      value: formatCatalogSource(runtimeSnapshot?.catalogSource)
    },
    {
      label: 'Auth',
      value: input.trustedLocalMode ? 'Trusted local' : input.token ? 'Token set' : 'Token missing'
    },
    {
      label: 'Shell',
      value: formatShell(runtimeSnapshot)
    },
    {
      label: 'Risk',
      value: highestRisk ? capitalize(highestRisk) : 'Low'
    },
    {
      label: 'Injection',
      value: injection.label
    },
    {
      label: 'Workspace',
      value: displayCatalog?.workspaceRoot ?? runtimeSnapshot?.health?.workspaceRoot ?? 'Unknown'
    }
  ];
}

function deriveAutomationNotice<TBlock extends PendingToolBlockLike>(
  input: OperatorPanelViewInput<TBlock>
): OperatorPanelNoticeView | undefined {
  const modeLabel = formatInjectionMode(input.requestInjectionMode);
  const hook = input.lastRequestHook;
  if (hook?.status === 'matched_without_injection') {
    return {
      tone: 'warn',
      message: `The last ChatGPT conversation request matched the page hook, but its body was not patched (${hook.transport ?? 'request'}). Insert/Copy MCP list remains the current recovery path.`
    };
  }

  if (hook?.status === 'missing_prompt') {
    return {
      tone: 'warn',
      message: 'The last ChatGPT conversation request reached the page hook before any MCP catalog prompt was ready. Hidden injection will resume after the next prompt sync.'
    };
  }

  const promptSource = input.requestPromptSource ?? input.gatewayRuntime?.catalogSource;
  if (promptSource === 'cache') {
    return {
      tone: 'muted',
      message: 'Cached bootstrap catalog is arming hidden request injection until the next successful live /tools sync.'
    };
  }

  if (promptSource === 'live' || input.hasLiveCatalog) {
    return {
      tone: 'muted',
      message: `Hidden request injection is currently using ${modeLabel}. Insert/Copy MCP list remains fallback only.`
    };
  }

  return undefined;
}

function deriveInjectionSummary<TBlock extends PendingToolBlockLike>(
  input: OperatorPanelViewInput<TBlock>
): { label: string } {
  const hook = input.lastRequestHook;
  if (hook?.status === 'injected') {
    return { label: `Injected via ${hook.transport ?? 'request'}` };
  }
  if (hook?.status === 'matched_without_injection') {
    return { label: 'Body not patched' };
  }
  if (hook?.status === 'missing_prompt') {
    return { label: 'Prompt missing' };
  }

  const promptSource = input.requestPromptSource ?? input.gatewayRuntime?.catalogSource;
  if (promptSource === 'cache') {
    return { label: 'Armed (cached)' };
  }
  if (promptSource === 'live' || input.hasLiveCatalog) {
    return { label: `Armed (${formatInjectionMode(input.requestInjectionMode)})` };
  }

  return { label: 'Unavailable' };
}

function getDetectionText<TBlock extends PendingToolBlockLike>(
  pending: TBlock[],
  visibleBatchCount: number,
  mode: OperatorPanelViewState['detectionMode']
): string {
  if (mode === 'batch_pending') {
    return `Detected ${pending.length} tool calls in one reply`;
  }
  if (mode === 'single_pending') {
    return `Detected ${pending[0]?.block.tool ?? 'unknown'}`;
  }
  if (mode === 'retryable_batch') {
    return `Retryable batch with ${visibleBatchCount} tools`;
  }
  return 'No pending tool calls in the current chat.';
}

function toPendingItems<TBlock extends PendingToolBlockLike>(
  blocks: TBlock[],
  capability: ReturnType<typeof assessPendingTools<TBlock>>
): OperatorPanelPendingItemView[] {
  return blocks.map((block, index) => ({
    capabilityLabel: formatCapabilityLabel(capability.items[index] ?? { block, state: 'unsupported' }),
    raw: 'raw' in block && typeof block.raw === 'string' ? block.raw : '',
    summary: summarizePendingBlock(block),
    tool: block.block.tool
  }));
}

function getRawPayload<TBlock extends PendingToolBlockLike>(block: TBlock | undefined): string | undefined {
  if (!block || !('raw' in block) || typeof block.raw !== 'string') {
    return undefined;
  }

  return block.raw;
}

function formatCatalogSource(source: CatalogSource | undefined): string {
  if (source === 'live') {
    return 'Live gateway';
  }
  if (source === 'cache') {
    return 'Cached bootstrap';
  }
  return 'Unavailable';
}

function formatInjectionMode(mode: RequestInjectionMode): string {
  return mode === 'synthetic_system' ? 'Synthetic system' : 'Prepend user';
}

function formatShell(snapshot: GatewayRuntimeSnapshot | undefined): string {
  const shell = snapshot?.health?.shell;
  if (!shell) {
    return 'Unknown';
  }
  if (!shell.available || !shell.resolved) {
    return 'Unavailable';
  }

  return shell.version ? `${shell.resolved} ${shell.version}` : shell.resolved;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
