/**
 * Appends a note on its own line to an order comment: adds a line break first
 * when the comment does not already end with one, and ends the note with one.
 */
export function appendCommentLine(comment: string, line: string): string {
  const base = comment && !comment.endsWith('\n') ? comment + '\n' : comment;
  return base + line + '\n';
}
