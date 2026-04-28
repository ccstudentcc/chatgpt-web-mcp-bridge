export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ToolSource = 'builtin' | 'external';
export type ExecutionProfile = 'legacy_auto' | 'reviewed' | 'yolo';
export type DetectionSource = 'assistant_message_scan' | 'startup_history_rescan' | 'manual_retry';
export type OperatorIntent = 'auto_flow' | 'manual_run' | 'manual_retry' | 'manual_approve';
export type PolicyAction = 'execute' | 'proposal_required' | 'confirmation_required' | 'deny' | 'skip';

export interface GatewayShellInfo {
  preferred: 'pwsh';
  resolved: 'pwsh' | 'powershell.exe' | null;
  available: boolean;
  version?: string;
}

export interface ToolCallError {
  code: string;
  message: string;
  details?: unknown;
}
