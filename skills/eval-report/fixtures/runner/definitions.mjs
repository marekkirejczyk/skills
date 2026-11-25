// Reads the fixture eval definitions, whatever their format, into one shape:
// { name, rule, knownBug, input, mocks, checks: [{ type, ... }] }.
// Check types: judge, calls, notCalls, callOrder, callCount, contains, never,
// showsCard, hasData, js, matches.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseYaml } from './yaml.mjs';

export function loadDefinitions(path) {
  const text = readFileSync(path, 'utf8');
  if (path.endsWith('.ts')) return fromCode(text);
  if (path.endsWith('.json')) return fromJson(JSON.parse(text));
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return fromYaml(parseYaml(text));
  throw new Error(`No loader for ${path}`);
}

// The code fixtures use no TypeScript-only syntax, so they run as JavaScript
// once the import of the harness is replaced by the harness itself.
function fromCode(text) {
  const cases = [];
  const harness = {
    evalCase: (name, options) => cases.push({ name, ...options }),
    judge: (label) => ({ type: 'judge', label }),
    exact: {
      calls: (tool, args) => ({ type: 'calls', tool, args }),
      notCalls: (tool) => ({ type: 'notCalls', tool }),
      callOrder: (first, then) => ({ type: 'callOrder', first, then }),
      callCount: (tool, times) => ({ type: 'callCount', tool, times }),
      contains: (value) => ({ type: 'contains', value }),
      never: (regex) => ({ type: 'never', regex }),
      showsCard: (kind) => ({ type: 'showsCard', kind }),
    },
  };
  runInNewContext(text.replace(/^import .*$/gm, ''), harness);
  return cases.map(normalize);
}

function fromJson(suite) {
  return suite.cases.map((c) => normalize({
    ...c,
    checks: c.checks.map((check) => {
      if ('judge' in check) return { type: 'judge', label: check.judge };
      if ('calls' in check) return { type: 'calls', tool: check.calls, args: check.with };
      if ('notCalls' in check) return { type: 'notCalls', tool: check.notCalls };
      if ('callCount' in check) return { type: 'callCount', tool: check.callCount, times: check.times };
      if ('showsCard' in check) return { type: 'showsCard', kind: check.showsCard };
      throw new Error(`Unknown JSON check ${JSON.stringify(check)}`);
    }),
  }));
}

function fromYaml(suite) {
  return suite.tests.map((test) => normalize({
    name: test.description,
    rule: test.rule,
    knownBug: test.knownBug,
    input: test.vars,
    mocks: test.mocks,
    checks: test.assert.map((a) => {
      switch (a.type) {
        case 'llm-rubric': return { type: 'judge', label: a.value };
        case 'tool-call-order': return { type: 'callOrder', first: a.value[0], then: a.value[1] };
        case 'not-tool-call': return { type: 'notCalls', tool: a.value };
        case 'contains': return { type: 'contains', value: String(a.value) };
        case 'is-json': return { type: 'hasData' };
        case 'javascript': return { type: 'js', code: a.value };
        case 'shows-card': return { type: 'showsCard', kind: a.value };
        case 'regex': return { type: 'matches', regex: new RegExp(a.value) };
        default: throw new Error(`Unknown YAML assert type ${a.type}`);
      }
    }),
  }));
}

function normalize(c) {
  return { name: c.name, rule: c.rule || '', knownBug: c.knownBug || '', input: c.input, mocks: c.mocks || {}, checks: c.checks || [] };
}
