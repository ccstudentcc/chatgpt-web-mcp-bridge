import { describe, expect, it } from 'vitest';
import { McpBlockSchema } from './schemas.js';

describe('McpBlockSchema', () => {
  it('defaults args to an empty object', () => {
    expect(McpBlockSchema.parse({ tool: 'read_file' })).toEqual({ tool: 'read_file', args: {} });
  });

  it('rejects an empty tool', () => {
    expect(() => McpBlockSchema.parse({ tool: '' })).toThrow();
  });
});
