import type {
  McpTurnAnalysis as BaseMcpTurnAnalysis,
  ParseResult as BaseParseResult,
  ParsedMcpCandidate
} from '../turn-runtime/mcp-turn-analysis.js';
import {
  analyzeMcpTurn as analyzeMcpTurnBase,
  parseMcpBlocks as parseMcpBlocksBase,
  parseMcpCandidateStrings as parseMcpCandidateStringsBase,
  parseRenderedMcpBlocks as parseRenderedMcpBlocksBase
} from '../turn-runtime/mcp-turn-analysis.js';
import { sha256Normalized } from './hash.js';

export interface ParsedMcpBlock extends ParsedMcpCandidate {
  callId: string;
}

export interface ParseResult extends BaseParseResult<ParsedMcpBlock> {}

export interface McpTurnAnalysis extends BaseMcpTurnAnalysis<ParsedMcpBlock> {}

export async function parseMcpBlocks(text: string): Promise<ParseResult> {
  return attachCallIds(await parseMcpBlocksBase(text));
}

export async function parseRenderedMcpBlocks(container: ParentNode): Promise<ParseResult> {
  return attachCallIds(await parseRenderedMcpBlocksBase(container));
}

export async function analyzeMcpTurn(container: ParentNode, visibleText: string): Promise<McpTurnAnalysis> {
  return attachCallIds(await analyzeMcpTurnBase(container, visibleText));
}

export async function parseMcpCandidateStrings(candidates: string[]): Promise<ParseResult> {
  return attachCallIds(await parseMcpCandidateStringsBase(candidates));
}

async function attachCallIds<T extends { blocks: ParsedMcpCandidate[] }>(
  parsed: T
): Promise<Omit<T, 'blocks'> & { blocks: ParsedMcpBlock[] }> {
  const blocks = await Promise.all(parsed.blocks.map(async (item) => ({
    ...item,
    callId: await sha256Normalized(item.raw)
  })));
  return {
    ...parsed,
    blocks
  };
}
