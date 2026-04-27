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

export async function parseMcpBlocks(text: string): Promise<ParseResult> {
  return parseMcpCandidateStrings(extractFencedBlockBodies(text));
}

export async function parseRenderedMcpBlocks(container: ParentNode): Promise<ParseResult> {
  const codeBodies = extractRenderedCandidates(container).map((candidate) => candidate.normalized);

  return parseMcpCandidateStrings(Array.from(new Set(codeBodies)));
}

export async function analyzeMcpTurn(container: ParentNode, visibleText: string): Promise<McpTurnAnalysis> {
  const renderedCandidates = extractRenderedCandidates(container);
  let renderedFailure: ParseResult | null = null;
  if (renderedCandidates.length > 0) {
    const parsed = await parseMcpCandidateStrings(Array.from(new Set(renderedCandidates.map((candidate) => candidate.normalized))));
    if (parsed.blocks.length > 0) {
      return finalizeTurnAnalysis(
        parsed,
        normalizeTurnResidual(removeRenderedCandidateText(visibleText, renderedCandidates)),
        true
      );
    }
    if (parsed.errors.length > 0) {
      renderedFailure = parsed;
    }
  }

  const fencedBodies = extractFencedBlockBodies(visibleText);
  let fencedFailure: ParseResult | null = null;
  if (fencedBodies.length > 0) {
    const parsed = await parseMcpCandidateStrings(fencedBodies);
    if (parsed.blocks.length > 0) {
      return finalizeTurnAnalysis(parsed, normalizeTurnResidual(stripFencedMcpBlocks(visibleText)), true);
    }
    if (parsed.errors.length > 0) {
      fencedFailure = parsed;
    }
  }

  const fallbackFailure = renderedFailure ?? fencedFailure;
  if (fallbackFailure) {
    return finalizeTurnAnalysis(fallbackFailure, normalizeTurnResidual(visibleText), true);
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

function removeRenderedCandidateText(text: string, candidates: Array<{ rawText: string }>): string {
  let remaining = text;
  for (const candidate of candidates) {
    if (!candidate.rawText) {
      continue;
    }

    const index = remaining.indexOf(candidate.rawText);
    if (index === -1) {
      continue;
    }

    remaining = `${remaining.slice(0, index)}${remaining.slice(index + candidate.rawText.length)}`;
  }

  return remaining;
}

function stripFencedMcpBlocks(text: string): string {
  return text.replace(fencedBlockPattern, '').trim();
}

function normalizeTurnResidual(text: string): string {
  return text
    .replace(/```mcp/gi, '')
    .replace(/```/g, '')
    .replace(/\bmcp\b/gi, '')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function finalizeTurnAnalysis(parsed: ParseResult, residualText: string, hasExplicitMcpBlock: boolean): McpTurnAnalysis {
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

  if (residualText.length > 0) {
    const recoverableResidual = parseLooseMcpResidual(residualText);
    if (hasExplicitMcpBlock && recoverableResidual.ok) {
      return {
        ...parsed,
        status: 'recoverable',
        warningReason: 'Assistant reply included unfenced MCP-like JSON before or around a valid MCP block. Ignoring the unfenced fragment and using only the valid MCP block(s).'
      };
    }

    return {
      ...parsed,
      status: 'invalid',
      violationReason: hasExplicitMcpBlock
        ? 'Assistant reply mixed valid MCP blocks with natural language or other non-block content. Tool-call turns must contain only fenced `mcp` blocks.'
        : 'Assistant reply mixed MCP tool calls with extra prose or unfenced content. Tool-call turns must contain only fenced `mcp` blocks.'
    };
  }

  return {
    ...parsed,
    status: 'valid'
  };
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

  const normalizedRemainder = normalizeTurnResidual(remaining);
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
