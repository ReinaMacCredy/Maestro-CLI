/**
 * TOOL.md frontmatter schema and tool status types.
 */

export interface ToolDefinition {
  name: string;
  binary: string;
  detect?: string;       // shell command to check if installed
  install?: string;      // installation instructions
  provides?: string;     // port name this tool provides (e.g., 'search', 'code-intel', 'tasks')
  description?: string;
}

export interface ToolStatus {
  name: string;
  binary: string;
  installed: boolean;
  version?: string;
  provides?: string;
  source: 'builtin' | 'plugin';
}
