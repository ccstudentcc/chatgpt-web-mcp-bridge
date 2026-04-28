import { describe, expect, it } from 'vitest';
import { writeFileProposalTool } from './write-file-proposal.js';

describe('writeFileProposalTool', () => {
  it('remains a disabled placeholder until a proposal owner exists', async () => {
    await expect(writeFileProposalTool.run(
      {
        path: 'docs/prd.md',
        content: '# Updated content',
        mode: 'replace'
      },
      { config: {} as never, logger: { async write() {} } }
    )).rejects.toMatchObject({
      code: 'TOOL_DISABLED'
    });
  });
});
