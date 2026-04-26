import { McpBlockSchema, type McpBlock } from '@cwmb/protocol';

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
      blocks.push({ block, raw: rawJson, callId: await sha256(rawJson) });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Invalid mcp block.');
    }
  }

  return { blocks, errors };
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input.replace(/\r\n/g, '\n').trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
