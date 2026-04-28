import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_GATEWAY_HOST, DEFAULT_GATEWAY_PORT } from '@cwmb/protocol';
import { DEFAULT_SHELL, normalizeConfiguredShell, type SupportedShell } from './shell-runtime/index.js';

export interface GatewayConfig {
  host: string;
  port: number;
  workspaceRoot: string;
  shell: SupportedShell;
  trustedLocalMode: boolean;
  allowPwsh: boolean;
  allowWrite: boolean;
  autoExecuteLowRisk: boolean;
  autoInsertResult: boolean;
  autoSendResult: boolean;
  maxToolRounds: number;
  maxFileSizeBytes: number;
  maxInsertedChars: number;
  maxGatewayResultChars: number;
  logRetentionDays: number;
  blockedPaths: string[];
}

export const appHome = path.join(os.homedir(), '.chatgpt-web-mcp-bridge');
export const configPath = resolveConfigPath(appHome);

interface LoadConfigOptions {
  appHomeOverride?: string;
  cwdOverride?: string;
}

const defaultConfig: GatewayConfig = {
  host: DEFAULT_GATEWAY_HOST,
  port: DEFAULT_GATEWAY_PORT,
  workspaceRoot: '',
  shell: DEFAULT_SHELL,
  trustedLocalMode: true,
  allowPwsh: false,
  allowWrite: false,
  autoExecuteLowRisk: true,
  autoInsertResult: true,
  autoSendResult: true,
  maxToolRounds: 3,
  maxFileSizeBytes: 1_048_576,
  maxInsertedChars: 60_000,
  maxGatewayResultChars: 200_000,
  logRetentionDays: 14,
  blockedPaths: [
    '.env',
    '.env.*',
    '*.pem',
    '*.key',
    '*.p12',
    '*.pfx',
    'id_rsa',
    'id_ed25519',
    'known_hosts',
    '.git/config',
    '.git-credentials',
    '.npmrc',
    '.yarnrc',
    '.pnpmrc',
    '.netrc',
    '.aws/**',
    '.azure/**',
    '.gcloud/**',
    'AppData/**',
    '**/Chrome/User Data/**',
    '**/Edge/User Data/**'
  ]
};

export async function loadConfig(options: LoadConfigOptions = {}): Promise<GatewayConfig> {
  const resolvedAppHome = options.appHomeOverride ?? appHome;
  const resolvedConfigPath = resolveConfigPath(resolvedAppHome);
  await fs.mkdir(resolvedAppHome, { recursive: true });

  let fileConfig: Partial<GatewayConfig> = {};
  let shouldPersistConfig = false;

  try {
    const raw = await fs.readFile(resolvedConfigPath, 'utf8');
    fileConfig = JSON.parse(raw) as Partial<GatewayConfig>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
    shouldPersistConfig = true;
  }

  const inferredWorkspaceRoot = inferWorkspaceRoot(options.cwdOverride ?? process.cwd());
  const envConfig: Partial<GatewayConfig> = {
    workspaceRoot: process.env.CWMB_WORKSPACE_ROOT,
    port: process.env.CWMB_PORT ? Number(process.env.CWMB_PORT) : undefined
  };

  const merged = { ...defaultConfig, ...fileConfig, ...removeUndefined(envConfig) } as GatewayConfig & { shell?: string };
  merged.shell = normalizeConfiguredShell(merged.shell);
  if (!merged.workspaceRoot && inferredWorkspaceRoot) {
    merged.workspaceRoot = inferredWorkspaceRoot;
    shouldPersistConfig = true;
  }

  if (merged.host !== '127.0.0.1') {
    throw new Error('For v0.1, gateway host must remain 127.0.0.1.');
  }

  if (shouldPersistConfig) {
    await fs.writeFile(resolvedConfigPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  }

  return merged;
}

export function resolveConfigPath(appHomeRoot: string = appHome): string {
  return path.join(appHomeRoot, 'config.json');
}

function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function inferWorkspaceRoot(cwd: string): string {
  const resolved = path.resolve(cwd);
  const resolvedHome = path.resolve(os.homedir());
  const filesystemRoot = path.parse(resolved).root;

  if (resolved === resolvedHome || resolved === filesystemRoot) {
    return '';
  }

  return resolved;
}
