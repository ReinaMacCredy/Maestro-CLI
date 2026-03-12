/**
 * MaestroError and formatting helpers for CLI output.
 */

export class MaestroError extends Error {
  readonly hints: string[];

  constructor(message: string, hints: string[] = []) {
    super(message);
    this.name = "MaestroError";
    this.hints = hints;
  }
}

export function formatError(context: string, message: string): string {
  return `[error] ${context}: ${message}`;
}

export function formatWarning(message: string): string {
  return `[warn] ${message}`;
}

export function formatSuggestion(message: string): string {
  return `[suggestion] ${message}`;
}

export function formatHint(message: string): string {
  return `[hint] ${message}`;
}
