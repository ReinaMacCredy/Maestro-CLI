/**
 * Slug and task folder name utilities.
 * Centralizes the title-to-slug and folder construction logic
 * used by plan-parser, fs-tasks, br adapter, and test mocks.
 */

/** Convert a human-readable title to a URL-safe slug. */
export function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/** Build a zero-padded task folder name from order/id and title. */
export function buildTaskFolder(order: number | string, title: string): string {
  return `${String(order).padStart(2, '0')}-${titleToSlug(title)}`;
}
