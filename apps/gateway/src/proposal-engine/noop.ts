import crypto from 'node:crypto';
import type { CreateProposalInput, Proposal, ProposalEngine, ProposalTransitionInput } from './types.js';

export interface NoopProposalEngineOptions {
  createId?: () => string;
  now?: () => string;
}

export function createNoopProposalEngine(options: NoopProposalEngineOptions = {}): ProposalEngine {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async listProposals() {
      return [];
    },
    async getProposal() {
      return undefined;
    },
    async createProposal(input: CreateProposalInput): Promise<Proposal> {
      const timestamp = now();
      return {
        proposalId: createId(),
        state: 'created',
        summary: input.summary,
        calls: input.calls,
        createdAt: timestamp,
        updatedAt: timestamp,
        affectedFiles: input.affectedFiles
      };
    },
    async transitionProposal(_input: ProposalTransitionInput) {
      return undefined;
    }
  };
}
