import type { ToolDecision } from '@cwmb/policy-model';
import type { ResultEnvelope } from '@cwmb/result-model';
import type {
  ExecutionProfile,
  GatewayShellInfo,
  OperatorIntent,
  PolicyAction,
  RiskLevel,
  ToolCallError,
  ToolSource
} from '@cwmb/shared-utils';
import type { TurnContext } from '@cwmb/turn-model';

export type CatalogSource = 'live' | 'cache';

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

export interface GatewayHealthContract {
  ok: true;
  version: string;
  platform: string;
  host: string;
  port: number;
  workspaceRoot: string;
  shell: GatewayShellInfo;
  trustedLocalMode: boolean;
  autoExecuteLowRisk: boolean;
  autoInsertResult: boolean;
  autoSendResult: boolean;
  maxToolRounds: number;
}

export interface GatewayRuntimeSnapshot {
  health?: GatewayHealthContract;
  catalog?: CatalogContract;
  catalogSource?: CatalogSource;
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

export type ToolCallLiveSuccess<TResult = unknown> = ToolCallSuccess<TResult> & {
  execute: ExecuteResponse;
};

export type ToolCallLiveFailure = ToolCallFailure & {
  execute: ExecuteResponse;
};

export type ToolCallLiveResponse<TResult = unknown> = ToolCallLiveSuccess<TResult> | ToolCallLiveFailure;
