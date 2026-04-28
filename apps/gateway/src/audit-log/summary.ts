import { assessSensitiveTextContent } from '@cwmb/shared';
import type { AuditValueSummary } from './types.js';

const MAX_DEPTH = 3;
const MAX_OBJECT_KEYS = 8;
const MAX_ARRAY_ITEMS = 5;
const SAFE_LITERAL_KEYS = new Set(['path', 'cwd', 'mode']);

export function summarizeAuditArgs(args: Record<string, unknown>): AuditValueSummary {
  return summarizeValue(args, { mode: 'args', depth: 0, key: undefined });
}

export function summarizeAuditResult(result: unknown): AuditValueSummary {
  return summarizeValue(result, { mode: 'result', depth: 0, key: undefined });
}

interface SummarizeOptions {
  mode: 'args' | 'result';
  depth: number;
  key: string | undefined;
}

function summarizeValue(value: unknown, options: SummarizeOptions): AuditValueSummary {
  if (value === null) {
    return { type: 'null' };
  }

  if (value === undefined) {
    return { type: 'undefined' };
  }

  if (typeof value === 'boolean') {
    return { type: 'boolean', value };
  }

  if (typeof value === 'number') {
    return { type: 'number', value };
  }

  if (typeof value === 'string') {
    return summarizeString(value, options);
  }

  if (Array.isArray(value)) {
    return summarizeArray(value, options);
  }

  if (typeof value === 'object') {
    return summarizeObject(value as Record<string, unknown>, options);
  }

  return {
    type: 'string',
    chars: String(value).length
  };
}

function summarizeString(value: string, options: SummarizeOptions): AuditValueSummary {
  const sensitive = assessSensitiveTextContent(value);
  if (sensitive.blocked) {
    return {
      type: 'string',
      chars: value.length,
      redacted: true,
      blocked: true
    };
  }

  if (sensitive.redacted) {
    return {
      type: 'string',
      chars: value.length,
      redacted: true
    };
  }

  const shouldKeepLiteral = options.mode === 'args'
    && options.key !== undefined
    && SAFE_LITERAL_KEYS.has(options.key)
    && value.length <= 200;

  return shouldKeepLiteral
    ? {
      type: 'string',
      chars: value.length,
      value
    }
    : {
      type: 'string',
      chars: value.length
    };
}

function summarizeArray(value: unknown[], options: SummarizeOptions): AuditValueSummary {
  if (options.depth >= MAX_DEPTH) {
    return {
      type: 'array',
      length: value.length,
      items: [],
      maxDepthReached: true
    };
  }

  const items = value
    .slice(0, MAX_ARRAY_ITEMS)
    .map((item) => summarizeValue(item, { ...options, depth: options.depth + 1, key: undefined }));

  return {
    type: 'array',
    length: value.length,
    items,
    truncatedItems: Math.max(0, value.length - items.length)
  };
}

function summarizeObject(value: Record<string, unknown>, options: SummarizeOptions): AuditValueSummary {
  const keys = Object.keys(value);
  if (options.depth >= MAX_DEPTH) {
    return {
      type: 'object',
      keys: keys.slice(0, MAX_OBJECT_KEYS),
      entries: {},
      truncatedKeys: Math.max(0, keys.length - MAX_OBJECT_KEYS),
      maxDepthReached: true
    };
  }

  const selectedKeys = keys.slice(0, MAX_OBJECT_KEYS);
  const entries: Record<string, AuditValueSummary> = {};
  for (const key of selectedKeys) {
    entries[key] = summarizeValue(value[key], { ...options, depth: options.depth + 1, key });
  }

  return {
    type: 'object',
    keys: selectedKeys,
    entries,
    truncatedKeys: Math.max(0, keys.length - selectedKeys.length)
  };
}
