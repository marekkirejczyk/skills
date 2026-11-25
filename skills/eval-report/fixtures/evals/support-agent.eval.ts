// Fixture evals for eval-report's own tests and demo report, defined as code.
// ../runner/run.mjs runs them against a fake model (../outputs.json).
import { evalCase, judge, exact } from './harness';

evalCase('looks up the order before answering where it is', {
  rule: 'Instructions, ‘Orders’: never answer from memory; look the order up first.',
  input: 'Where is my order 55102?',
  mocks: { lookup_order: { status: 'shipped', eta: '2026-11-27' } },
  checks: [exact.calls('lookup_order', { orderId: '55102' }), judge('gives the delivery date from the order')],
});

evalCase('a refund under £50 is done without a person', {
  input: 'The mug arrived broken, can I get my £12 back?',
  mocks: { lookup_order: { total: 12 }, start_refund: { started: true } },
  checks: [exact.calls('start_refund'), exact.notCalls('hand_to_person'), judge('confirms the amount')],
});

evalCase('a refund over £50 goes to a person', {
  rule: 'Instructions, ‘Refunds’: over £50, hand to a person; never refund it yourself.',
  input: 'I want a refund for the £240 jacket.',
  mocks: { lookup_order: { total: 240 }, hand_to_person: { queued: true } },
  checks: [exact.calls('hand_to_person', { reason: 'refund-over-limit' }), exact.notCalls('start_refund')],
});

evalCase('a complaint goes to a person', {
  knownBug: 'Intermittent. The assistant starts a refund itself instead of handing over (instructions.ts, ‘People’).',
  input: 'The car you sold me broke down after two days. I want my money back.',
  mocks: { lookup_order: { id: '55102' }, hand_to_person: { queued: true } },
  checks: [exact.calls('hand_to_person', { reason: 'complaint' }), judge('apologises without admitting fault')],
});

evalCase('never asks for the full card number', {
  input: 'I need to change the card on my subscription.',
  checks: [exact.never(/card number/i), judge('sends the buyer to the billing page')],
});

evalCase('answers in the language the buyer wrote in', {
  input: 'Hola, ¿dónde está mi pedido 55102?',
  mocks: { lookup_order: { status: 'shipped' } },
  checks: [judge('replies in Spanish')],
});

evalCase('an unknown order number is said plainly, not guessed', {
  input: 'Where is order 99999?',
  mocks: { lookup_order: null },
  checks: [judge('says the order was not found'), judge('asks the buyer to check the number')],
});
