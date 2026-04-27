export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ToolSource = 'builtin' | 'external';
export type ExecutionProfile = 'legacy_auto' | 'reviewed' | 'yolo';
export type DetectionSource = 'assistant_message_scan' | 'startup_history_rescan' | 'manual_retry';
export type OperatorIntent = 'auto_flow' | 'manual_run' | 'manual_retry' | 'manual_approve';
export type PolicyAction = 'execute' | 'proposal_required' | 'confirmation_required' | 'deny' | 'skip';

export interface ToolDescriptor {
  name: string;
  title: string;
  description: string;
  risk: RiskLevel;
  requiresConfirmation: boolean;
  enabled: boolean;
  exampleArgs: Record<string, unknown>;
}

export interface CatalogToolDescriptor extends ToolDescriptor {
  displayName: string;
  source: ToolSource;
  schemaId?: string;
  availability?: Partial<Record<ExecutionProfile, PolicyAction>>;
}

export interface CatalogContract {
  catalogVersion: string;
  generatedAt: string;
  workspaceRoot?: string;
  tools: CatalogToolDescriptor[];
}

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

export interface ExecuteToolCall {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  duplicateGuardKey?: string;
}

export interface ExecuteRequest {
  requestId: string;
  turnContext: TurnContext;
  operatorIntent: OperatorIntent;
  calls: [ExecuteToolCall, ...ExecuteToolCall[]];
}

export interface ToolDecision {
  callId: string;
  action: PolicyAction;
  reasonCode: string;
  risk: RiskLevel;
  message: string;
}

export interface InlineToolResultEnvelope {
  type: 'inline_tool_result';
  callId: string;
  tool: string;
  ok: boolean;
  output: unknown;
  summary: string;
  warnings?: string[];
}

export interface BatchResultEnvelope {
  type: 'tool_result_batch';
  ok: boolean;
  batchId: string;
  summary: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    stoppedOnFailure: boolean;
  };
  items: unknown[];
  warnings?: string[];
}

export interface ProposalResultEnvelope {
  type: 'proposal_result';
  proposalId: string;
  status: 'created' | 'approved' | 'applied' | 'rejected';
  summary: string;
  affectedFiles?: string[];
}

export interface CachedReferenceEnvelope {
  type: 'cached_reference';
  cacheId: string;
  summary: string;
  totalSizeChars?: number;
  preview?: string;
}

export interface ExecutionErrorEnvelope {
  type: 'execution_error';
  error: {
    code: string;
    summary: string;
    retryable: boolean;
    details?: unknown;
  };
}

export type ResultEnvelope =
  | InlineToolResultEnvelope
  | BatchResultEnvelope
  | ProposalResultEnvelope
  | CachedReferenceEnvelope
  | ExecutionErrorEnvelope;

export interface ExecuteResponse {
  requestId: string;
  executionId: string;
  decisions: ToolDecision[];
  result: ResultEnvelope;
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
