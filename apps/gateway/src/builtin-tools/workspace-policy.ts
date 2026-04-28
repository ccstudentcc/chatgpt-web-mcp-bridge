import type { GatewayConfig } from '../config.js';
import { resolveWorkspacePath, type PathPolicy, type ResolvedWorkspacePath } from '../tool-policy/path-policy.js';

type WorkspacePolicyConfig = Pick<GatewayConfig, 'workspaceRoot' | 'blockedPaths'> | PathPolicy;

export function createWorkspacePathPolicy(config: WorkspacePolicyConfig): PathPolicy {
  return {
    workspaceRoot: config.workspaceRoot,
    blockedPatterns: 'blockedPatterns' in config ? config.blockedPatterns : config.blockedPaths
  };
}

export async function resolveBuiltinToolPath(
  inputPath: string,
  config: WorkspacePolicyConfig
): Promise<ResolvedWorkspacePath> {
  return resolveWorkspacePath(inputPath, createWorkspacePathPolicy(config));
}
