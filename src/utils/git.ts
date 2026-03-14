import simpleGit from 'simple-git';

export interface GitAuditSummary {
  baseCommit?: string;
  headCommit: string;
  dirtyWorkingTree: boolean;
  changedFilesSinceBase: string[];
  uncommittedFiles: string[];
}

function parseNameOnly(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function getHeadCommit(projectRoot: string): Promise<string> {
  const git = simpleGit(projectRoot);
  return (await git.revparse(['HEAD'])).trim();
}

export async function collectGitAuditSummary(
  projectRoot: string,
  baseCommit?: string,
): Promise<GitAuditSummary> {
  const git = simpleGit(projectRoot);
  const headCommit = await getHeadCommit(projectRoot);
  const status = await git.status();
  const dirtyWorkingTree = !status.isClean();

  let changedFilesSinceBase: string[] = [];
  if (baseCommit) {
    try {
      changedFilesSinceBase = parseNameOnly(
        await git.diff(['--name-only', `${baseCommit}..HEAD`]),
      );
    } catch {
      changedFilesSinceBase = [];
    }
  }

  const uncommittedFiles = parseNameOnly(await git.diff(['--name-only']));
  const stagedFiles = parseNameOnly(await git.diff(['--cached', '--name-only']));
  const allUncommittedFiles = Array.from(new Set([
    ...uncommittedFiles,
    ...stagedFiles,
    ...status.not_added,
  ]));

  return {
    baseCommit,
    headCommit,
    dirtyWorkingTree,
    changedFilesSinceBase,
    uncommittedFiles: allUncommittedFiles,
  };
}
