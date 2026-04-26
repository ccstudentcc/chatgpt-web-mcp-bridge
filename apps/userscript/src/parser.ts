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

const fencedBlockPattern = /```mcp\s*\n([\s\S]*?)\n```/g;

export async function parseMcpBlocks(text: string): Promise<ParseResult> {
  return parseMcpCandidateStrings(extractFencedBlockBodies(text));
}

export async function parseRenderedMcpBlocks(container: ParentNode): Promise<ParseResult> {
  const codeBodies = Array.from(container.querySelectorAll('pre code'))
    .map((node) => (node.textContent ?? '').trim())
    .filter((text) => text.length > 0);

  return parseMcpCandidateStrings(codeBodies);
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
