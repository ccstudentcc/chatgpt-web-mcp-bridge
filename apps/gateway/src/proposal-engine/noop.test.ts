import { describe, expect, expectTypeOf, it } from 'vitest';
import { createNoopProposalEngine } from './noop.js';
import type { Proposal, ProposalEngine } from './types.js';

describe('noop proposal engine', () => {
  it('exposes a consumable typed proposal contract', async () => {
    const engine = createNoopProposalEngine({
      createId: () => 'proposal-1',
      now: () => '2026-04-28T00:00:00.000Z'
    });

    expectTypeOf(engine).toMatchTypeOf<ProposalEngine>();

    const created = await engine.createProposal({
      summary: 'Write README update',
      affectedFiles: ['README.md'],
      calls: [{
        call: {
          callId: 'call-1',
          tool: 'write_file',
          args: { path: 'README.md', content: 'hello' }
        },
        descriptor: {
          name: 'write_file',
          title: 'write_file',
          displayName: 'Write file',
          description: 'Write a file.',
          risk: 'high',
          requiresConfirmation: true,
          enabled: true,
          exampleArgs: {},
          source: 'builtin'
        },
        decision: {
          callId: 'call-1',
          action: 'proposal_required',
          reasonCode: 'WRITE_FILE_REQUIRES_PROPOSAL',
          risk: 'high',
          message: 'Write operations require a proposal.'
        }
      }]
    });

    expectTypeOf(created).toMatchTypeOf<Proposal>();
    expect(created).toMatchObject({
      proposalId: 'proposal-1',
      state: 'created',
      affectedFiles: ['README.md']
    });
    await expect(engine.listProposals()).resolves.toEqual([]);
    await expect(engine.transitionProposal({
      proposalId: 'proposal-1',
      nextState: 'approved'
    })).resolves.toBeUndefined();
  });
});
