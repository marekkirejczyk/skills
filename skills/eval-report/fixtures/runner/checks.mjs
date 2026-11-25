// Runs one definition's checks against one round of the fake model's answer.
// Exact checks are worked out here; judge checks take the fake judge's verdict.

const text = (output) => (output == null ? '' : typeof output === 'string' ? output : output.text || '');
const haystack = (output) => text(output) + (output && output.data !== undefined ? `\n${JSON.stringify(output.data)}` : '');
const json = (value) => JSON.stringify(value);
const matchesArgs = (actual = {}, expected = {}) => Object.entries(expected).every(([k, v]) => json(actual[k]) === json(v));

export function runChecks(checks, round) {
  const calls = round.toolCalls || [];
  const called = (tool) => calls.filter((call) => call.tool === tool);
  return checks.map((check) => {
    switch (check.type) {
      case 'judge': {
        const verdict = round.verdicts && round.verdicts[check.label];
        if (verdict === undefined) throw new Error(`No fake verdict for "${check.label}"`);
        return result('judge', check.label, verdict === true, verdict === true ? '' : verdict);
      }
      case 'calls': {
        const label = `calls ${check.tool}${check.args ? ` with ${json(check.args)}` : ''}`;
        const all = called(check.tool);
        if (!all.length) return result('exact', label, false, `${check.tool} was not called.`);
        const ok = !check.args || all.some((call) => matchesArgs(call.args, check.args));
        return result('exact', label, ok, ok ? '' : `Called with ${json(all[0].args)}.`);
      }
      case 'notCalls': {
        const n = called(check.tool).length;
        return result('exact', `does not call ${check.tool}`, n === 0, n ? `Called ${n} time${n === 1 ? '' : 's'}.` : '');
      }
      case 'callOrder': {
        const first = calls.findIndex((call) => call.tool === check.first);
        const then = calls.findIndex((call) => call.tool === check.then);
        const ok = first >= 0 && then >= 0 && first < then;
        const why = first < 0 || then < 0 ? 'Not both called.' : `${check.then} was called first.`;
        return result('exact', `calls ${check.first} before ${check.then}`, ok, ok ? '' : why);
      }
      case 'callCount': {
        const n = called(check.tool).length;
        return result('exact', `calls ${check.tool} ${check.times} times`, n === check.times, n === check.times ? '' : `Called ${n} time${n === 1 ? '' : 's'}.`);
      }
      case 'contains': {
        const ok = haystack(round.output).includes(check.value);
        return result('exact', `output contains "${check.value}"`, ok, ok ? '' : 'Not in the output.');
      }
      case 'never': {
        const match = text(round.output).match(check.regex);
        return result('exact', `never says ${check.regex}`, !match, match ? `Matched “${match[0]}”.` : '');
      }
      case 'showsCard': {
        const cards = (round.output && round.output.cards) || [];
        const ok = cards.some((card) => String(card.kind).toLowerCase() === check.kind.toLowerCase());
        return result('exact', `shows a ${check.kind} card`, ok, ok ? '' : `No ${check.kind} card.`);
      }
      case 'hasData': {
        const ok = Boolean(round.output && round.output.data !== undefined);
        return result('exact', 'output has data', ok, ok ? '' : 'No data in the output.');
      }
      case 'js': {
        let ok = false;
        try { ok = Boolean(new Function('output', `return (${check.code});`)(round.output)); } catch { ok = false; }
        return result('exact', check.code, ok, ok ? '' : 'Evaluated to false.');
      }
      case 'matches': {
        const ok = check.regex.test(haystack(round.output));
        return result('exact', `output matches ${check.regex}`, ok, ok ? '' : 'No match.');
      }
      default:
        throw new Error(`Unknown check type ${check.type}`);
    }
  });
}

function result(kind, label, pass, reason) {
  return reason ? { kind, label, pass, reason } : { kind, label, pass };
}
