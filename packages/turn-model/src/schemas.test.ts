import { describe, expect, it } from 'vitest';
import { McpBlockSchema, TurnContextSchema } from './schemas.js';

describe('McpBlockSchema', () => {
  it('defaults args to an empty object', () => {
    expect(McpBlockSchema.parse({ tool: 'read_file' })).toEqual({ tool: 'read_file', args: {} });
  });

  it('rejects an empty tool', () => {
    expect(() => McpBlockSchema.parse({ tool: '' })).toThrow();
  });
});

describe('TurnContextSchema', () => {
  it('accepts the active batch-first turn context shape', () => {
    expect(TurnContextSchema.parse({
      source: { page: 'chatgpt', conversationId: 'conv-1', assistantTurnId: 'msg-1' },
      detectionSource: 'assistant_message_scan',
      requestInjection: { channel: 'hidden_request_prompt', promptVersion: 'bridge-v1' },
      executionProfile: 'legacy_auto'
    })).toMatchObject({
      source: { page: 'chatgpt', conversationId: 'conv-1' },
      requestInjection: { channel: 'hidden_request_prompt' }
    });
  });
});
