import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_GATEWAY_HOST, DEFAULT_GATEWAY_PORT } from '@cwmb/protocol';

export interface GatewayConfig {
  host: string;
  port: number;
  workspaceRoot: string;
  shell: 'pwsh' | 'powershell.exe';
  allowPwsh: boolean;
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
export const configPath = path.join(appHome, 'config.json');

const defaultConfig: GatewayConfig = {
  host: DEFAULT_GATEWAY_HOST,
  port: DEFAULT_GATEWAY_PORT,
  workspaceRoot: '',
  shell: 'pwsh',
  allowPwsh: false,
  autoExecuteLowRisk: false,
  autoInsertResult: true,
  autoSendResult: false,
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

export async function loadConfig(): Promise<GatewayConfig> {
  let fileConfig: Partial<GatewayConfig> = {};

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    fileConfig = JSON.parse(raw) as Partial<GatewayConfig>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  const envConfig: Partial<GatewayConfig> = {
    workspaceRoot: process.env.CWMB_WORKSPACE_ROOT,
    port: process.env.CWMB_PORT ? Number(process.env.CWMB_PORT) : undefined
  };

  const merged = { ...defaultConfig, ...fileConfig, ...removeUndefined(envConfig) };
  if (merged.host !== '127.0.0.1') {
    throw new Error('For v0.1, gateway host must remain 127.0.0.1.');
  }

  return merged;
}

function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}
