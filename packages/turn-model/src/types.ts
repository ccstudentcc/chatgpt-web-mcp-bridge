import type { DetectionSource, ExecutionProfile } from '@cwmb/shared-utils';

export interface TurnSource {
  page: 'chatgpt';
  conversationId?: string;
  assistantTurnId?: string;
}

export interface RequestInjectionContext {
  channel: 'hidden_request_prompt' | 'manual_prompt';
  promptVersion?: string;
}

export interface TurnContext {
  source: TurnSource;
  detectionSource: DetectionSource;
  requestInjection: RequestInjectionContext;
  executionProfile: ExecutionProfile;
}

export interface McpBlock {
  tool: string;
  args: Record<string, unknown>;
}
