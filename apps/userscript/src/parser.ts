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
  const blocks: ParsedMcpBlock[] = [];
  const errors: string[] = [];
  const matches = text.matchAll(fencedBlockPattern);

  for (const match of matches) {
    const rawJson = (match[1] ?? '').trim();
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
