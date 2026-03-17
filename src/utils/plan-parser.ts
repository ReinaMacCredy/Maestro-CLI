/**
 * Plan parsing utilities for maestroCLI.
 * Extracted from hive-core/src/services/taskService.ts.
 *
 * Parses ### N. Task Name headings from plan.md, extracts dependency
 * annotations, validates the dependency graph, and detects cycles.
 */

export interface ParsedTask {
  folder: string;
  order: number;
  name: string;
  description: string;
  /** Raw dependency numbers parsed from plan. null = not specified (use implicit), [] = explicit none */
  dependsOnNumbers: number[] | null;
}

/**
 * Parse tasks from a plan.md file.
 * Expects headings in the format: ### N. Task Name
 */
export function parseTasksFromPlan(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = content.split('\n');

  let currentTask: ParsedTask | null = null;
  let descriptionLines: string[] = [];

  const dependsOnRegex = /^\s*(?:[-*]\s+)?\*{0,2}Depends\s+on\*{0,2}\s*:\s*(.+)$/i;

  for (const line of lines) {
    const taskMatch = line.match(/^###\s+(\d+)\.\s+(.+)$/);

    if (taskMatch) {
      if (currentTask) {
        currentTask.description = descriptionLines.join('\n').trim();
        tasks.push(currentTask);
      }

      const order = parseInt(taskMatch[1], 10);
      const rawName = taskMatch[2].trim();
      const folderName = rawName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const folder = `${String(order).padStart(2, '0')}-${folderName}`;

      currentTask = {
        folder,
        order,
        name: rawName,
        description: '',
        dependsOnNumbers: null,
      };
      descriptionLines = [];
    } else if (currentTask) {
      if (line.match(/^##\s+/) || line.match(/^###\s+[^0-9]/)) {
        currentTask.description = descriptionLines.join('\n').trim();
        tasks.push(currentTask);
        currentTask = null;
        descriptionLines = [];
      } else {
        const dependsMatch = line.match(dependsOnRegex);
        if (dependsMatch) {
          const value = dependsMatch[1].trim().toLowerCase();
          if (value === 'none') {
            currentTask.dependsOnNumbers = [];
          } else {
            const numbers = value
              .split(/[,\s]+/)
              .map(s => parseInt(s.trim(), 10))
              .filter(n => !isNaN(n));
            currentTask.dependsOnNumbers = numbers;
          }
        }
        descriptionLines.push(line);
      }
    }
  }

  if (currentTask) {
    currentTask.description = descriptionLines.join('\n').trim();
    tasks.push(currentTask);
  }

  return tasks;
}

/**
 * Validate the dependency graph for errors.
 * Checks for unknown task numbers, self-dependencies, and cycles.
 */
export function validateDependencyGraph(tasks: ParsedTask[], featureName: string): void {
  const taskNumbers = new Set(tasks.map(t => t.order));

  for (const task of tasks) {
    if (task.dependsOnNumbers === null) {
      continue;
    }

    for (const depNum of task.dependsOnNumbers) {
      if (depNum === task.order) {
        throw new Error(
          `Invalid dependency graph in plan.md: Self-dependency detected for task ${task.order} ("${task.name}"). ` +
          `A task cannot depend on itself. Please fix the "Depends on:" line in plan.md.`
        );
      }

      if (!taskNumbers.has(depNum)) {
        throw new Error(
          `Invalid dependency graph in plan.md: Unknown task number ${depNum} referenced in dependencies for task ${task.order} ("${task.name}"). ` +
          `Available task numbers are: ${Array.from(taskNumbers).sort((a, b) => a - b).join(', ')}. ` +
          `Please fix the "Depends on:" line in plan.md.`
        );
      }
    }
  }

  detectCycles(tasks);
}

/**
 * Detect cycles in the dependency graph using DFS.
 */
export function detectCycles(tasks: ParsedTask[]): void {
  const taskByOrder = new Map(tasks.map(t => [t.order, t]));

  const getDependencies = (task: ParsedTask): number[] => {
    if (task.dependsOnNumbers !== null) {
      return task.dependsOnNumbers;
    }
    if (task.order === 1) {
      return [];
    }
    return [task.order - 1];
  };

  const visited = new Map<number, number>();
  const path: number[] = [];

  const dfs = (taskOrder: number): void => {
    const state = visited.get(taskOrder);

    if (state === 2) {
      return;
    }

    if (state === 1) {
      const cycleStart = path.indexOf(taskOrder);
      const cyclePath = [...path.slice(cycleStart), taskOrder];
      const cycleDesc = cyclePath.join(' -> ');

      throw new Error(
        `Invalid dependency graph in plan.md: Cycle detected in task dependencies: ${cycleDesc}. ` +
        `Tasks cannot have circular dependencies. Please fix the "Depends on:" lines in plan.md.`
      );
    }

    visited.set(taskOrder, 1);
    path.push(taskOrder);

    const task = taskByOrder.get(taskOrder);
    if (task) {
      const deps = getDependencies(task);
      for (const depOrder of deps) {
        dfs(depOrder);
      }
    }

    path.pop();
    visited.set(taskOrder, 2);
  };

  for (const task of tasks) {
    if (!visited.has(task.order)) {
      dfs(task.order);
    }
  }
}

/**
 * Resolve dependency numbers to folder names.
 * - null = not specified --> implicit sequential (depend on N-1)
 * - [] = explicit "none" --> no dependencies
 * - [N, M] = explicit dependencies
 */
export function resolveDependencies(task: ParsedTask, allTasks: ParsedTask[]): string[] {
  if (task.dependsOnNumbers !== null && task.dependsOnNumbers.length === 0) {
    return [];
  }

  if (task.dependsOnNumbers !== null) {
    return task.dependsOnNumbers
      .map(num => allTasks.find(t => t.order === num)?.folder)
      .filter((folder): folder is string => folder !== undefined);
  }

  if (task.order === 1) {
    return [];
  }

  const previousTask = allTasks.find(t => t.order === task.order - 1);
  return previousTask ? [previousTask.folder] : [];
}
