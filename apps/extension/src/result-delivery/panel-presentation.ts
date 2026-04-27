export type DeliveryStatusTone =
  | 'cwmb-badge-ok'
  | 'cwmb-badge-danger'
  | 'cwmb-badge-warn'
  | 'cwmb-badge-info';

export function summarizeArgs(args: Record<string, unknown>, maxLength = 48): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return 'no args';

  const summary = entries
    .slice(0, 2)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(', ');

  if (entries.length > 2) {
    return truncate(`${summary}, ...`, maxLength);
  }

  return truncate(summary, maxLength);
}

export function summarizePendingBlock<TBlock extends {
  block: {
    tool: string;
    args: Record<string, unknown>;
  };
}>(block: TBlock): string {
  return `${block.block.tool} ${summarizeArgs(block.block.args)}`.trim();
}

export function getDeliveryStatusTone(status: string): DeliveryStatusTone {
  if (status === 'sent' || status === 'batch_sent' || status === 'idle') return 'cwmb-badge-ok';
  if (status === 'failed' || status === 'unauthorized' || status === 'disconnected' || status === 'invalid_mcp_turn') return 'cwmb-badge-danger';
  if (status === 'detected' || status === 'detected_batch' || status === 'batch_stopped_on_failure') return 'cwmb-badge-warn';
  return 'cwmb-badge-info';
}

export function getDeliveryStatusLabel(status: string): string {
  switch (status) {
    case 'invalid_mcp_turn':
      return 'Invalid MCP turn';
    case 'detected_batch':
      return 'Batch queued';
    case 'batch_executing':
      return 'Batch running';
    case 'batch_result_ready':
      return 'Batch ready';
    case 'batch_inserted':
      return 'Batch inserted';
    case 'batch_sent':
      return 'Batch sent';
    case 'batch_stopped_on_failure':
      return 'Batch stopped';
    case 'result_ready':
      return 'Result ready';
    default:
      return status.replace(/_/g, ' ');
  }
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (value && typeof value === 'object') return '{...}';
  return String(value);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
