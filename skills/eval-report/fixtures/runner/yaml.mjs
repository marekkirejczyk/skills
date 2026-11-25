// A small YAML reader for the subset the fixture evals use: block mappings
// and sequences, flow { } and [ ], quoted and plain scalars, # comments.
// Enough for the fixtures, with no dependency; not a general YAML parser.

export function parseYaml(text) {
  const lines = text.split('\n')
    .map((raw, index) => ({ raw, number: index + 1 }))
    .filter(({ raw }) => raw.trim() && !raw.trim().startsWith('#'))
    .map(({ raw, number }) => ({ indent: raw.length - raw.trimStart().length, text: raw.trim(), number }));
  const state = { lines, at: 0 };
  const value = parseBlock(state, lines[0]?.indent ?? 0);
  if (state.at < lines.length) throw new Error(`YAML: unexpected indentation on line ${lines[state.at].number}`);
  return value;
}

function parseBlock(state, indent) {
  const first = state.lines[state.at];
  if (!first || first.indent < indent) return null;
  return first.text.startsWith('- ') || first.text === '-' ? parseSequence(state, first.indent) : parseMapping(state, first.indent);
}

function parseSequence(state, indent) {
  const items = [];
  while (state.at < state.lines.length) {
    const line = state.lines[state.at];
    if (line.indent !== indent || !(line.text.startsWith('- ') || line.text === '-')) break;
    const rest = line.text.slice(1).trimStart();
    if (!rest) { state.at++; items.push(parseBlock(state, indent + 1)); continue; }
    if (isMappingEntry(rest)) {
      // "- key: value" starts a mapping whose entries sit two columns in.
      state.lines[state.at] = { ...line, indent: indent + 2, text: rest };
      items.push(parseMapping(state, indent + 2));
    } else {
      state.at++;
      items.push(parseScalarOrFlow(rest, line.number));
    }
  }
  return items;
}

function parseMapping(state, indent) {
  const object = {};
  while (state.at < state.lines.length) {
    const line = state.lines[state.at];
    if (line.indent !== indent || line.text.startsWith('- ')) break;
    const match = line.text.match(/^("[^"]*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/);
    if (!match) throw new Error(`YAML: expected "key: value" on line ${line.number}`);
    const key = unquote(match[1]);
    state.at++;
    if (match[2] !== undefined && match[2] !== '') object[key] = parseScalarOrFlow(match[2], line.number);
    else {
      const next = state.lines[state.at];
      // A sequence may sit at the same indentation as its key.
      if (next && (next.indent > indent || (next.indent === indent && next.text.startsWith('- ')))) object[key] = parseBlock(state, next.indent);
      else object[key] = null;
    }
  }
  return object;
}

function isMappingEntry(text) {
  return /^("[^"]*"|'[^']*'|[^\s{["'][^:]*?):(\s|$)/.test(text);
}

function unquote(text) {
  const t = text.trim();
  if (t.startsWith('"')) return JSON.parse(t);
  if (t.startsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

function parseScalarOrFlow(text, number) {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    const parser = { text: t, at: 0, number };
    const value = parseFlow(parser);
    skipSpace(parser);
    if (parser.at !== t.length) throw new Error(`YAML: unexpected "${t.slice(parser.at)}" on line ${number}`);
    return value;
  }
  return plainScalar(t);
}

function plainScalar(t) {
  if (t.startsWith('"') || t.startsWith("'")) return unquote(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function skipSpace(p) { while (p.text[p.at] === ' ') p.at++; }

function parseFlow(p) {
  skipSpace(p);
  const open = p.text[p.at];
  if (open === '{' || open === '[') {
    const close = open === '{' ? '}' : ']';
    const result = open === '{' ? {} : [];
    p.at++;
    for (;;) {
      skipSpace(p);
      if (p.text[p.at] === close) { p.at++; return result; }
      if (open === '{') {
        const key = readFlowScalar(p, ':');
        if (p.text[p.at] !== ':') throw new Error(`YAML: expected ":" on line ${p.number}`);
        p.at++;
        result[unquote(key)] = parseFlow(p);
      } else {
        result.push(parseFlow(p));
      }
      skipSpace(p);
      if (p.text[p.at] === ',') p.at++;
      else if (p.text[p.at] !== close) throw new Error(`YAML: expected "," or "${close}" on line ${p.number}`);
    }
  }
  return plainScalar(readFlowScalar(p, ''));
}

// Reads a quoted scalar, or a plain one up to , ] } (and the extra stop character).
function readFlowScalar(p, stop) {
  skipSpace(p);
  const quote = p.text[p.at];
  if (quote === '"' || quote === "'") {
    let end = p.at + 1;
    while (end < p.text.length) {
      if (p.text[end] === '\\' && quote === '"') { end += 2; continue; }
      if (p.text[end] === quote) {
        if (quote === "'" && p.text[end + 1] === "'") { end += 2; continue; }
        break;
      }
      end++;
    }
    const raw = p.text.slice(p.at, end + 1);
    p.at = end + 1;
    return raw;
  }
  let end = p.at;
  while (end < p.text.length && !',]}'.includes(p.text[end]) && !(stop && p.text[end] === stop && /\s/.test(p.text[end + 1] || ' '))) end++;
  const raw = p.text.slice(p.at, end).trim();
  p.at = end;
  return raw;
}
