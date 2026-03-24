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
  /** Optional goal for goal-based memory scoring in handoff context. */
  goal?: string;
  /** Session that generated this handoff. */
  fromSession?: string;
  /** Host that generated this handoff. */
  fromHost?: string;
  /** maestro version that generated this handoff. */
  maestroVersion?: string;
}

export interface HandoffResult {
  /** Local file path where the handoff document was written. */
  filePath: string;
  /** Agent Mail thread ID (if Agent Mail was reachable). */
  threadId?: string;
  /** Whether Agent Mail delivery succeeded. */
  agentMailSent: boolean;
}

export interface HandoffPort {
  /** Build a handoff document for a bead from br + maestro memory + git diff. */
  buildHandoff(feature: string, taskId: string): Promise<HandoffDocument>;
  /** Write handoff to local file + send via Agent Mail. File is primary, Agent Mail is notification. */
  sendHandoff(feature: string, handoff: HandoffDocument, targetAgent?: string): Promise<HandoffResult>;
  /** Receive pending handoffs (reads local files + Agent Mail inbox). */
  receiveHandoffs(feature: string | undefined, agentId?: string): Promise<HandoffDocument[]>;
  /** Acknowledge receipt of a handoff. */
  acknowledgeHandoff(threadId: string): Promise<void>;
}
