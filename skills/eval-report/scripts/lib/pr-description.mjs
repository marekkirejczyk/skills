// The eval report's block at the top of a PR description, and the marker that
// finds its comment again.
export const COMMENT_MARK = '<!-- eval-report:comment -->';
const START = '<!-- eval-report:start -->';
const END = '<!-- eval-report:end -->';

// Replaces the block if the description has one, otherwise puts it first.
// The author's own text is never changed.
export function withBlock(description, headline) {
  const block = `${START}\n${headline.trim()}\n${END}`;
  const body = description || '';
  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  return pattern.test(body) ? body.replace(pattern, () => block) : `${block}\n\n${body}`.trimEnd() + '\n';
}
