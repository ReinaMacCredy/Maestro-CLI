import { defineCommand, runMain } from 'citty';
import { setOutputMode } from './lib/output.ts';
import { initServices } from './services.ts';
import { findProjectRoot } from './utils/detection.ts';

// Static imports -- required for bun build --compile (dynamic import() is unsupported)
import cmdInit from './commands/init.ts';
import cmdStatus from './commands/status.ts';
import cmdFeatureCreate from './commands/feature-create.ts';
import cmdFeatureList from './commands/feature-list.ts';
import cmdFeatureInfo from './commands/feature-info.ts';
import cmdFeatureActive from './commands/feature-active.ts';
import cmdFeatureComplete from './commands/feature-complete.ts';
import cmdPlanWrite from './commands/plan-write.ts';
import cmdPlanRead from './commands/plan-read.ts';
import cmdPlanApprove from './commands/plan-approve.ts';
import cmdPlanRevoke from './commands/plan-revoke.ts';
import cmdPlanComment from './commands/plan-comment.ts';
import cmdPlanCommentsClear from './commands/plan-comments-clear.ts';
import cmdTaskSync from './commands/task-sync.ts';
import cmdTaskCreate from './commands/task-create.ts';
import cmdTaskUpdate from './commands/task-update.ts';
import cmdTaskList from './commands/task-list.ts';
import cmdTaskInfo from './commands/task-info.ts';
import cmdTaskSpecRead from './commands/task-spec-read.ts';
import cmdTaskSpecWrite from './commands/task-spec-write.ts';
import cmdTaskReportRead from './commands/task-report-read.ts';
import cmdTaskReportWrite from './commands/task-report-write.ts';
import cmdSubtaskCreate from './commands/subtask-create.ts';
import cmdSubtaskUpdate from './commands/subtask-update.ts';
import cmdSubtaskList from './commands/subtask-list.ts';
import cmdSubtaskInfo from './commands/subtask-info.ts';
import cmdSubtaskDelete from './commands/subtask-delete.ts';
import cmdSubtaskSpecRead from './commands/subtask-spec-read.ts';
import cmdSubtaskSpecWrite from './commands/subtask-spec-write.ts';
import cmdSubtaskReportRead from './commands/subtask-report-read.ts';
import cmdSubtaskReportWrite from './commands/subtask-report-write.ts';
import cmdWorktreeStart from './commands/worktree-start.ts';
import cmdWorktreeCommit from './commands/worktree-commit.ts';
import cmdWorktreeList from './commands/worktree-list.ts';
import cmdWorktreeDiff from './commands/worktree-diff.ts';
import cmdWorktreeConflicts from './commands/worktree-conflicts.ts';
import cmdWorktreeCleanup from './commands/worktree-cleanup.ts';
import cmdWorktreeDiscard from './commands/worktree-discard.ts';
import cmdWorktreeCreate from './commands/worktree-create.ts';
import cmdWorktreePatchExport from './commands/worktree-patch-export.ts';
import cmdWorktreePatchApply from './commands/worktree-patch-apply.ts';
import cmdMerge from './commands/merge.ts';
import cmdContextWrite from './commands/context-write.ts';
import cmdContextRead from './commands/context-read.ts';
import cmdContextList from './commands/context-list.ts';
import cmdContextDelete from './commands/context-delete.ts';
import cmdContextCompile from './commands/context-compile.ts';
import cmdContextArchive from './commands/context-archive.ts';
import cmdContextStats from './commands/context-stats.ts';
import cmdSessionTrack from './commands/session-track.ts';
import cmdSessionList from './commands/session-list.ts';
import cmdSessionMaster from './commands/session-master.ts';
import cmdSessionFork from './commands/session-fork.ts';
import cmdSessionFresh from './commands/session-fresh.ts';
import cmdAskCreate from './commands/ask-create.ts';
import cmdAskAnswer from './commands/ask-answer.ts';
import cmdAskList from './commands/ask-list.ts';
import cmdAskCleanup from './commands/ask-cleanup.ts';
import cmdConfigGet from './commands/config-get.ts';
import cmdConfigSet from './commands/config-set.ts';
import cmdConfigAgent from './commands/config-agent.ts';
import cmdAgentsMd from './commands/agents-md.ts';
import cmdSandboxStatus from './commands/sandbox-status.ts';
import cmdSandboxWrap from './commands/sandbox-wrap.ts';
import cmdSkill from './commands/skill.ts';
import cmdSkillList from './commands/skill-list.ts';

const subCommands = {
  'init': cmdInit,
  'status': cmdStatus,
  'feature-create': cmdFeatureCreate,
  'feature-list': cmdFeatureList,
  'feature-info': cmdFeatureInfo,
  'feature-active': cmdFeatureActive,
  'feature-complete': cmdFeatureComplete,
  'plan-write': cmdPlanWrite,
  'plan-read': cmdPlanRead,
  'plan-approve': cmdPlanApprove,
  'plan-revoke': cmdPlanRevoke,
  'plan-comment': cmdPlanComment,
  'plan-comments-clear': cmdPlanCommentsClear,
  'task-sync': cmdTaskSync,
  'task-create': cmdTaskCreate,
  'task-update': cmdTaskUpdate,
  'task-list': cmdTaskList,
  'task-info': cmdTaskInfo,
  'task-spec-read': cmdTaskSpecRead,
  'task-spec-write': cmdTaskSpecWrite,
  'task-report-read': cmdTaskReportRead,
  'task-report-write': cmdTaskReportWrite,
  'subtask-create': cmdSubtaskCreate,
  'subtask-update': cmdSubtaskUpdate,
  'subtask-list': cmdSubtaskList,
  'subtask-info': cmdSubtaskInfo,
  'subtask-delete': cmdSubtaskDelete,
  'subtask-spec-read': cmdSubtaskSpecRead,
  'subtask-spec-write': cmdSubtaskSpecWrite,
  'subtask-report-read': cmdSubtaskReportRead,
  'subtask-report-write': cmdSubtaskReportWrite,
  'worktree-start': cmdWorktreeStart,
  'worktree-commit': cmdWorktreeCommit,
  'worktree-list': cmdWorktreeList,
  'worktree-diff': cmdWorktreeDiff,
  'worktree-conflicts': cmdWorktreeConflicts,
  'worktree-cleanup': cmdWorktreeCleanup,
  'worktree-discard': cmdWorktreeDiscard,
  'worktree-create': cmdWorktreeCreate,
  'worktree-patch-export': cmdWorktreePatchExport,
  'worktree-patch-apply': cmdWorktreePatchApply,
  'merge': cmdMerge,
  'context-write': cmdContextWrite,
  'context-read': cmdContextRead,
  'context-list': cmdContextList,
  'context-delete': cmdContextDelete,
  'context-compile': cmdContextCompile,
  'context-archive': cmdContextArchive,
  'context-stats': cmdContextStats,
  'session-track': cmdSessionTrack,
  'session-list': cmdSessionList,
  'session-master': cmdSessionMaster,
  'session-fork': cmdSessionFork,
  'session-fresh': cmdSessionFresh,
  'ask-create': cmdAskCreate,
  'ask-answer': cmdAskAnswer,
  'ask-list': cmdAskList,
  'ask-cleanup': cmdAskCleanup,
  'config-get': cmdConfigGet,
  'config-set': cmdConfigSet,
  'config-agent': cmdConfigAgent,
  'agents-md': cmdAgentsMd,
  'sandbox-status': cmdSandboxStatus,
  'sandbox-wrap': cmdSandboxWrap,
  'skill': cmdSkill,
  'skill-list': cmdSkillList,
} as const;

const subCommandNames = Object.keys(subCommands);

const main = defineCommand({
  meta: {
    name: 'maestro',
    version: '0.1.0',
    description: 'Agent-optimized development orchestrator',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
    version: {
      type: 'boolean',
      alias: 'v',
      description: 'Show version',
      default: false,
    },
  },
  subCommands,
  setup({ args }) {
    if (args.json) {
      setOutputMode('json');
    }

    const isInit = process.argv.includes('init');
    if (!isInit) {
      const projectRoot = findProjectRoot(process.cwd());
      if (projectRoot) {
        initServices(projectRoot);
      }
    }
  },
  run({ args, rawArgs }) {
    const hasSubCommand = rawArgs.some(a => subCommandNames.includes(a));
    if (hasSubCommand) return;

    if (args.version) {
      console.log('0.1.0');
      return;
    }
    console.log('maestro 0.1.0 -- agent-optimized development orchestrator');
    console.log('Run `maestro --help` for usage.');
  },
});

runMain(main);
