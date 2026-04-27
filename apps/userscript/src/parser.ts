import { McpBlockSchema, type McpBlock } from '@cwmb/protocol';
import { sha256Normalized } from './hash.js';

export interface ParsedMcpBlock {
  block: McpBlock;
  raw: string;
  callId: string;
}

export interface ParseResult {
  blocks: ParsedMcpBlock[];
  errors: string[];
}

export interface McpTurnAnalysis extends ParseResult {
  status: 'none' | 'valid' | 'recoverable' | 'invalid';
  violationReason?: string;
  warningReason?: string;
}

interface TextRange {
  start: number;
  end: number;
}

interface TurnResidualSegments {
  prefix: string;
  middles: string[];
  suffix: string;
}

const fencedBlockPattern = /```mcp\s*\n([\s\S]*?)\n```/g;
const renderedBlockSelector = [
  'pre code',
  'pre',
  'code',
  '[data-testid*="code"]',
  '[class*="code-block"]',
  '[class*="CodeBlock"]',
  '[class*="whitespace-pre"]'
].join(', ');
const ignorableUiResidualPatterns = [
  /^thought for .+$/i,
  /^reasoned for .+$/i,
  /^思考了.+$/u,
  /^已思考.+$/u,
  /^思考中$/u
];

export async function parseMcpBlocks(text: string): Promise<ParseResult> {
  return parseMcpCandidateStrings(extractFencedBlockBodies(text));
}

export async function parseRenderedMcpBlocks(container: ParentNode): Promise<ParseResult> {
  const codeBodies = extractRenderedCandidates(container).map((candidate) => candidate.normalized);

  return parseMcpCandidateStrings(Array.from(new Set(codeBodies)));
}

export async function analyzeMcpTurn(container: ParentNode, visibleText: string): Promise<McpTurnAnalysis> {
  const fencedMatches = extractFencedBlockMatches(visibleText);
  const fencedBodies = fencedMatches.map((match) => match.body);
  let fencedFailure: ParseResult | null = null;
  if (fencedBodies.length > 0) {
    const parsed = await parseMcpCandidateStrings(fencedBodies);
    if (parsed.blocks.length > 0) {
      return finalizeTurnAnalysis(
        parsed,
        splitResidualSegments(visibleText, fencedMatches.map(({ start, end }) => ({ start, end }))),
        true
      );
    }
    if (parsed.errors.length > 0) {
      fencedFailure = parsed;
    }
  }

  const renderedCandidates = extractRenderedCandidates(container);
  let renderedSuccess: { parsed: ParseResult; ranges: TextRange[] } | null = null;
  let renderedFailure: ParseResult | null = null;
  if (renderedCandidates.length > 0) {
    const parsed = await parseMcpCandidateStrings(Array.from(new Set(renderedCandidates.map((candidate) => candidate.normalized))));
    if (parsed.blocks.length > 0) {
      const ranges = locateRenderedCandidateRanges(visibleText, renderedCandidates);
      if (ranges.length >= parsed.blocks.length) {
        return finalizeTurnAnalysis(
          parsed,
          splitResidualSegments(visibleText, ranges),
          true
        );
      }

      renderedSuccess = { parsed, ranges };
    }
    if (parsed.errors.length > 0) {
      renderedFailure = parsed;
    }
  }

  if (renderedSuccess) {
    return finalizeTurnAnalysis(
      renderedSuccess.parsed,
      renderedSuccess.ranges.length > 0
        ? splitResidualSegments(visibleText, renderedSuccess.ranges)
        : { prefix: '', middles: [], suffix: '' },
      true
    );
  }

  const fallbackFailure = renderedFailure ?? fencedFailure;
  if (fallbackFailure) {
    return finalizeTurnAnalysis(fallbackFailure, {
      prefix: normalizeResidualText(visibleText),
      middles: [],
      suffix: ''
    }, true);
  }

  return {
    blocks: [],
    errors: [],
    status: 'none'
  };
}

export async function parseMcpCandidateStrings(candidates: string[]): Promise<ParseResult> {
  const blocks: ParsedMcpBlock[] = [];
  const errors: string[] = [];
  for (const rawJson of candidates) {
    try {
      const json = JSON.parse(rawJson) as unknown;
      const block = McpBlockSchema.parse(json);
      blocks.push({ block, raw: rawJson, callId: await sha256Normalized(rawJson) });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Invalid mcp block.');
    }
  }

  return { blocks, errors };
}

function extractFencedBlockBodies(text: string): string[] {
  return Array.from(text.matchAll(fencedBlockPattern), (match) => (match[1] ?? '').trim()).filter((body) => body.length > 0);
}

function extractFencedBlockMatches(text: string): Array<TextRange & { body: string }> {
  return Array.from(text.matchAll(fencedBlockPattern), (match) => {
    const fullText = match[0] ?? '';
    const body = (match[1] ?? '').trim();
    const start = match.index ?? -1;
    return {
      body,
      start,
      end: start >= 0 ? start + fullText.length : -1
    };
  }).filter((match) => match.body.length > 0 && match.start >= 0 && match.end >= 0);
}

function extractRenderedCandidates(container: ParentNode): Array<{ rawText: string; normalized: string }> {
  const seen = new Set<string>();
  const results: Array<{ rawText: string; normalized: string }> = [];

  for (const node of Array.from(container.querySelectorAll(renderedBlockSelector))) {
    const rawText = (node.textContent ?? '').trim();
    if (!looksLikeExplicitMcpRenderedBlock(rawText)) {
      continue;
    }
    const normalized = normalizeRenderedCandidate(rawText);
    if (!normalized) {
      continue;
    }

    const key = `${rawText}\n---\n${normalized}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push({ rawText, normalized });
  }

  return results;
}

function locateRenderedCandidateRanges(text: string, candidates: Array<{ rawText: string; normalized: string }>): TextRange[] {
  const ranges: TextRange[] = [];
  let cursor = 0;

  for (const candidate of candidates) {
    const range = locateRenderedCandidateRange(text, candidate, cursor);
    if (!range) {
      continue;
    }

    ranges.push(range);
    cursor = range.end;
  }

  return ranges;
}

function locateRenderedCandidateRange(
  text: string,
  candidate: { rawText: string; normalized: string },
  cursor: number
): TextRange | null {
  if (candidate.rawText) {
    const rawStart = text.indexOf(candidate.rawText, cursor);
    if (rawStart !== -1) {
      return {
        start: rawStart,
        end: rawStart + candidate.rawText.length
      };
    }
  }

  if (!candidate.normalized) {
    return null;
  }

  const normalizedStart = text.indexOf(candidate.normalized, cursor);
  if (normalizedStart === -1) {
    return null;
  }

  return {
    start: findRenderedPreludeStart(text, cursor, normalizedStart),
    end: normalizedStart + candidate.normalized.length
  };
}

function findRenderedPreludeStart(text: string, cursor: number, bodyStart: number): number {
  const prelude = text.slice(cursor, bodyStart).replace(/\u00a0/g, ' ');
  const mcpMatch = /(?:^|\n)([ \t]*mcp[ \t\r\n]*)$/i.exec(prelude);
  if (!mcpMatch || typeof mcpMatch.index !== 'number') {
    return bodyStart;
  }

  return cursor + mcpMatch.index + (mcpMatch[0].startsWith('\n') ? 1 : 0);
}

function looksLikeExplicitMcpRenderedBlock(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (/^```mcp\b/i.test(trimmed)) {
    return true;
  }

  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) {
    return false;
  }

  const prelude = trimmed.slice(0, firstBrace).replace(/\u00a0/g, ' ').trim().toLowerCase();
  if (!prelude) {
    return false;
  }

  return /^mcp\b/.test(prelude);
}

function normalizeRenderedCandidate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return '';
  }

  return trimmed.slice(firstBrace, lastBrace + 1).trim();
}

function normalizeResidualText(text: string): string {
  return text.replace(/\u00a0/g, ' ').trim();
}

function splitResidualSegments(text: string, ranges: TextRange[]): TurnResidualSegments {
  if (ranges.length === 0) {
    return {
      prefix: normalizeResidualText(text),
      middles: [],
      suffix: ''
    };
  }

  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const prefix = normalizeResidualText(text.slice(0, sorted[0]?.start ?? 0));
  const middles: string[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (!current || !next) {
      continue;
    }

    middles.push(normalizeResidualText(text.slice(current.end, next.start)));
  }

  const last = sorted[sorted.length - 1];
  return {
    prefix,
    middles,
    suffix: last ? normalizeResidualText(text.slice(last.end)) : ''
  };
}

function finalizeTurnAnalysis(parsed: ParseResult, residual: TurnResidualSegments, hasExplicitMcpBlock: boolean): McpTurnAnalysis {
  if (parsed.blocks.length === 0) {
    return {
      ...parsed,
      status: 'invalid',
      violationReason: 'Assistant reply contained MCP-like content, but no valid MCP block could be parsed.'
    };
  }

  if (parsed.errors.length > 0) {
    return {
      ...parsed,
      status: 'invalid',
      violationReason: 'Assistant reply mixed valid MCP blocks with invalid MCP JSON.'
    };
  }

  const trailingResidual = [...residual.middles, residual.suffix].filter((segment) => segment.length > 0).join('\n\n');
  if (trailingResidual.length > 0) {
    const recoverableResidual = parseLooseMcpResidual(trailingResidual);
    if (hasExplicitMcpBlock && recoverableResidual.ok) {
      return {
        ...parsed,
        status: 'recoverable',
        warningReason: 'Assistant reply included unfenced MCP-like JSON between or after valid MCP blocks. Ignoring the unfenced fragment and using only the valid MCP block(s).'
      };
    }

    if (hasExplicitMcpBlock && isIgnorableUiResidual(trailingResidual)) {
      return {
        ...parsed,
        status: 'recoverable',
        warningReason: 'Assistant reply included a ChatGPT thinking/status label after valid MCP blocks. Ignoring the UI residual and using only the valid MCP block(s).'
      };
    }

    return {
      ...parsed,
      status: 'invalid',
      violationReason: 'Assistant reply added natural language or other non-block content after MCP tool-call blocks. Once the first fenced `mcp` block appears, the rest of the reply must stay MCP-only.'
    };
  }

  if (residual.prefix.length > 0) {
    const recoverablePrefix = parseLooseMcpResidual(residual.prefix);
    if (hasExplicitMcpBlock && recoverablePrefix.ok) {
      return {
        ...parsed,
        status: 'recoverable',
        warningReason: 'Assistant reply included unfenced MCP-like JSON before a valid MCP block. Ignoring the unfenced fragment and using only the valid MCP block(s).'
      };
    }

    if (looksLikeMcpLikeResidual(residual.prefix)) {
      return {
        ...parsed,
        status: 'invalid',
        violationReason: 'Assistant reply contained malformed or unfenced MCP-like content before a valid MCP block.'
      };
    }
  }

  return {
    ...parsed,
    status: 'valid'
  };
}

function looksLikeMcpLikeResidual(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || (!trimmed.includes('"tool"') && !trimmed.includes('"args"'))) {
    return false;
  }

  return /^(```\s*)?mcp\b/i.test(trimmed)
    || trimmed.startsWith('{')
    || trimmed.startsWith('[');
}

function isIgnorableUiResidual(text: string): boolean {
  const normalizedLines = text
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (normalizedLines.length === 0) {
    return false;
  }

  return normalizedLines.every((line) => ignorableUiResidualPatterns.some((pattern) => pattern.test(line)));
}

function parseLooseMcpResidual(text: string): { ok: boolean } {
  const trimmed = text.trim();
  if (!trimmed || !trimmed.includes('"tool"') || !trimmed.includes('"args"')) {
    return { ok: false };
  }

  const candidates = extractLooseJsonObjects(trimmed);
  if (candidates.length === 0) {
    return { ok: false };
  }

  let remaining = trimmed;
  for (const candidate of candidates) {
    const index = remaining.indexOf(candidate);
    if (index === -1) {
      return { ok: false };
    }
    remaining = `${remaining.slice(0, index)}${remaining.slice(index + candidate.length)}`;
  }

  const normalizedRemainder = normalizeResidualText(remaining);
  if (normalizedRemainder.length > 0) {
    return { ok: false };
  }

  return { ok: candidates.every(isValidMcpJsonCandidate) };
}

function extractLooseJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (!char) {
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth === 0) {
        return [];
      }
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, index + 1).trim());
        start = -1;
      }
    }
  }

  if (depth !== 0 || start !== -1) {
    return [];
  }

  return objects;
}

function isValidMcpJsonCandidate(candidate: string): boolean {
  try {
    const json = JSON.parse(candidate) as unknown;
    McpBlockSchema.parse(json);
    return true;
  } catch {
    return false;
  }
}
