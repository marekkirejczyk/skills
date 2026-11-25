// Shorthands the fixture evals use to describe their checks and tool calls.

export const judge = (name, passed = true, reason) => ({ kind: 'judge', name, passed, reason });
export const exact = (name, passed = true, reason, about) => ({ kind: 'exact', name, passed, reason, ...(about ? { about } : {}) });
export const mock = (tool, args, result, extra = {}) => ({ tool, args, result, ...extra });
export const buyer = (text) => ({ role: 'buyer', text });
export const assistant = (text, blocks) => ({ role: 'assistant', text, ...(blocks ? { blocks } : {}) });
export const EVERY_REPLY = exact('the 6 rules for every reply');
