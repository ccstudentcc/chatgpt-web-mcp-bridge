import type { ParsedMcpBlock } from './parser.js';

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

export function summarizePendingBlock(block: ParsedMcpBlock): string {
  return `${block.block.tool} ${summarizeArgs(block.block.args)}`.trim();
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
