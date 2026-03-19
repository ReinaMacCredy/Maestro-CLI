/**
 * HandoffPort -- cross-agent context transfer interface.
 * Backed by Agent Mail for messaging and CASS for session search.
 */

export interface HandoffDocument {
  beadId: string;
  beadState: {
    title: string;
    status: string;
    description?: string;
    design?: string;
    acceptanceCriteria?: string;
  };
  decisions: Array<{ key: string; value: string }>;
  modifiedFiles: string[];
  blockers: string[];
  openQuestions: string[];
  nextSteps: string[];
  criticalContext: string;
  cassPointer?: string;
  agentMailThread?: string;
}

export interface HandoffPort {
  /** Build a handoff document for a bead from br + maestro memory + git diff. */
  buildHandoff(feature: string, taskId: string): Promise<HandoffDocument>;
  /** Send handoff via Agent Mail, keyed to bead ID as thread topic. */
  sendHandoff(handoff: HandoffDocument, targetAgent?: string): Promise<{ threadId: string }>;
  /** Receive pending handoffs for the current agent. */
  receiveHandoffs(agentId: string): Promise<HandoffDocument[]>;
  /** Acknowledge receipt of a handoff. */
  acknowledgeHandoff(threadId: string): Promise<void>;
}
