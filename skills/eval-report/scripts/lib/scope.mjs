// Which eval cases are new or changed in a scope (a commit or a PR), from a
// zero-context git diff and the lines each case is defined on.

export const SCOPES = ['all', 'commit', 'pr'];

// Map of path → { added: whole file is new, ranges: [[first, last], ...] of touched lines in the new file }.
export function parseDiff(diffText) {
  const files = new Map();
  let current = null;
  let fileIsNew = false;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      fileIsNew = false;
      current = null;
    } else if (line.startsWith('--- /dev/null')) {
      fileIsNew = true;
    } else if (line.startsWith('+++ ')) {
      const path = line.slice(4);
      if (path === '/dev/null') continue;
      current = { added: fileIsNew, ranges: [] };
      files.set(path.replace(/^b\//, ''), current);
    } else if (line.startsWith('@@') && current) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!match) continue;
      const first = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      // A pure deletion (count 0) touches the line it was deleted after.
      current.ranges.push(count === 0 ? [Math.max(first, 1), Math.max(first, 1)] : [first, first + count - 1]);
    }
  }
  return files;
}

export function markFilesAdded(changes, paths) {
  for (const path of paths) changes.set(path, { added: true, ranges: [] });
  return changes;
}

function touches(ranges, first, last) {
  return ranges.some(([from, to]) => from <= last && to >= first);
}

// 'new' when the case's own definition line is added, 'changed' when any line
// up to the next case is touched, otherwise null. A case without a known line
// in a touched file counts as changed: better shown than hidden.
export function classifyCase(change, line, nextCaseLine) {
  if (!change) return null;
  if (change.added) return 'new';
  if (line === null) return change.ranges.length > 0 ? 'changed' : null;
  if (touches(change.ranges, line, line)) return 'new';
  const last = nextCaseLine === null ? Infinity : nextCaseLine - 1;
  return touches(change.ranges, line, last) ? 'changed' : null;
}

export function markChangedCases(files, changes) {
  for (const file of files) {
    const starts = file.cases.map((evalCase) => evalCase.line).filter((line) => line !== null).sort((a, b) => a - b);
    for (const evalCase of file.cases) {
      if (evalCase.change) continue;
      const nextCaseLine = evalCase.line === null ? null : (starts.find((start) => start > evalCase.line) ?? null);
      evalCase.change = classifyCase(changes.get(file.path), evalCase.line, nextCaseLine);
    }
  }
  return files;
}

export function globToRegExp(glob) {
  let pattern = '';
  for (let index = 0; index < glob.length; index++) {
    const character = glob[index];
    if (glob.startsWith('**/', index)) {
      pattern += '(?:.*/)?';
      index += 2;
    } else if (glob.startsWith('**', index)) {
      pattern += '.*';
      index += 1;
    } else if (character === '*') {
      pattern += '[^/]*';
    } else if (character === '?') {
      pattern += '[^/]';
    } else {
      pattern += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function changedEvalFiles(changes, evalGlobs) {
  const patterns = evalGlobs.map(globToRegExp);
  return [...changes.keys()].filter((path) => patterns.some((pattern) => pattern.test(path))).sort();
}
