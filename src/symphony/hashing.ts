/**
 * Content hashing for Symphony manifest tracking.
 */

import { createHash } from 'node:crypto';

/** Compute SHA-256 hex digest of content string. */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
