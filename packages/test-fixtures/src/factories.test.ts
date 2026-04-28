import { describe, expect, it } from 'vitest';
import {
  createCatalogContract,
  createExecuteRequest,
  createGatewayHealthContract
} from './factories.js';

describe('test fixtures', () => {
  it('creates shared catalog, gateway health, and execute-request helpers', () => {
    expect(createCatalogContract().tools[0]?.name).toBe('read_file');
    expect(createGatewayHealthContract().shell.available).toBe(true);
    expect(createExecuteRequest().calls[0]?.tool).toBe('read_file');
  });
});
