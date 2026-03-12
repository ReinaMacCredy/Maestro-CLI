/**
 * VcsPort -- abstract interface for version control operations.
 * Future use: swap between git, jj, etc.
 */

export interface VcsPort {
  getCurrentBranch(): Promise<string>;
  getHead(): Promise<string>;
  isClean(): Promise<boolean>;
  branchExists(name: string): Promise<boolean>;
}
