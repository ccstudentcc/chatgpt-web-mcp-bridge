import { describe, expect, it } from 'vitest';
import { McpBlockSchema, ToolDescriptorSchema } from './schemas.js';

describe('McpBlockSchema', () => {
  it('defaults args to an empty object', () => {
    expect(McpBlockSchema.parse({ tool: 'read_file' })).toEqual({ tool: 'read_file', args: {} });
  });

  it('rejects an empty tool', () => {
    expect(() => McpBlockSchema.parse({ tool: '' })).toThrow();
  });
});

describe('ToolDescriptorSchema', () => {
  it('defaults exampleArgs to an empty object', () => {
    expect(ToolDescriptorSchema.parse({
      name: 'read_file',
      title: 'Read file',
      description: 'Read a file.',
      risk: 'low',
      requiresConfirmation: false,
      enabled: true
    })).toMatchObject({ exampleArgs: {} });
  });
});
