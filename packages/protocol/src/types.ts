export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolDescriptor {
  name: string;
  title: string;
  description: string;
  risk: RiskLevel;
  requiresConfirmation: boolean;
  enabled: boolean;
}

export interface ToolCallSource {
  page: 'chatgpt';
  conversationId?: string;
  callId: string;
}

export interface ToolCallRequest {
  tool: string;
  args: Record<string, unknown>;
  source: ToolCallSource;
}

export interface ToolCallError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ToolCallSuccess<TResult = unknown> {
  ok: true;
  tool: string;
  result: TResult;
  warnings: string[];
  durationMs: number;
}

export interface ToolCallFailure {
  ok: false;
  tool: string;
  error: ToolCallError;
  warnings: string[];
  durationMs: number;
}

export type ToolCallResponse<TResult = unknown> = ToolCallSuccess<TResult> | ToolCallFailure;

export interface McpBlock {
  tool: string;
  args: Record<string, unknown>;
}
