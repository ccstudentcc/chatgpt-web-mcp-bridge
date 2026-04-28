import type { ToolDecision } from '@cwmb/policy-model';
import type { CatalogToolDescriptor, ExecuteToolCall } from '@cwmb/tool-contracts';

export type ProposalState = 'created' | 'approved' | 'applied' | 'rejected';

export interface ProposalCall {
  call: ExecuteToolCall;
  descriptor: CatalogToolDescriptor;
  decision: ToolDecision;
}

export interface Proposal {
  proposalId: string;
  state: ProposalState;
  summary: string;
  calls: [ProposalCall, ...ProposalCall[]];
  createdAt: string;
  updatedAt: string;
  affectedFiles?: string[];
}

export interface CreateProposalInput {
  summary: string;
  calls: [ProposalCall, ...ProposalCall[]];
  affectedFiles?: string[];
}

export interface ProposalTransitionInput {
  proposalId: string;
  nextState: Exclude<ProposalState, 'created'>;
}

export interface ProposalEngine {
  listProposals(): Promise<Proposal[]>;
  getProposal(proposalId: string): Promise<Proposal | undefined>;
  createProposal(input: CreateProposalInput): Promise<Proposal>;
  transitionProposal(input: ProposalTransitionInput): Promise<Proposal | undefined>;
}
