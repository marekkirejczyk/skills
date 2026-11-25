// Shorthands the fixture evals use to describe their checks and tool calls.

export const judge = (name, passed = true, reason) => ({ kind: 'judge', name, passed, reason });
export const exact = (name, passed = true, reason) => ({ kind: 'exact', name, passed, reason });
export const mock = (tool, args, result, extra = {}) => ({ tool, args, result, ...extra });
export const buyer = (text) => ({ role: 'buyer', text });
export const assistant = (text) => ({ role: 'assistant', text });
export const EVERY_REPLY = exact('the 6 rules for every reply');
