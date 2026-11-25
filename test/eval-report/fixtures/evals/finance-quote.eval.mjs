// Finance: the assistant explains car finance without quoting before an eligibility check.

import { assistant, buyer, EVERY_REPLY, exact, judge, mock } from '../checks.mjs';

const FINANCE = 'Instructions, ‘Finance’';
const golfQuestion = [buyer('What would monthly payments be on the £10,995 Golf?'), assistant('Over how many years?'), buyer('Four, with £1,500 down.')];

export default [
  {
    name: 'APR is quoted only after the eligibility check',
    rule: `${FINANCE}: never quote a rate before check_eligibility returns`,
    rounds: 2,
    run: (round) =>
      round === 1
        ? {
            input: golfQuestion,
            output: {
              text: 'Here’s a rough idea, before any credit check:',
              blocks: [{ type: 'list', items: [{ label: 'Deposit', value: '£1,500' }, { label: 'Term', value: '48 months' }, { label: 'APR', value: '9.9% representative' }, { label: 'Monthly', value: '£239.40' }] }],
            },
            checks: [
              judge('No rate or monthly figure before eligibility is known', false, 'Quotes 9.9% APR and £239.40 with no check run.'),
              exact('calls check_eligibility before quote_finance', false, 'quote_finance was called first.'),
              EVERY_REPLY,
            ],
            mocks: [mock('quote_finance', { price: 10995, deposit: 1500, months: 48 }, { apr: 9.9, monthly: 239.4 }), mock('check_eligibility', undefined, undefined, { summary: 'not called' })],
          }
        : {
            input: golfQuestion,
            output: { text: 'I’ll check what you’re eligible for first; it won’t affect your credit score.', blocks: [{ type: 'card', title: 'Eligibility form', body: 'Name, date of birth, address for the last 3 years' }] },
            checks: [judge('No rate or monthly figure before eligibility is known'), exact('calls check_eligibility before quote_finance'), EVERY_REPLY],
            mocks: [mock('check_eligibility', {}, { form: 'shown' }, { fake: 'softSearch' })],
          },
  },
  {
    name: 'a declined credit check is told kindly, with a next step',
    rule: `${FINANCE}: say plainly it was declined, and offer what is still possible`,
    run: () => ({
      input: 'Did I get approved?',
      output: 'Not this time, sorry: the lender couldn’t offer finance on this car.\n\nYou could still buy it outright, or I can look for cars under £6,000 that other lenders cover.',
      checks: [judge('Says plainly that finance was declined'), judge('Offers a next step'), EVERY_REPLY],
      mocks: [mock('check_eligibility', { applicationId: 'a-91' }, { status: 'declined' }, { fake: 'declined' })],
    }),
  },
  {
    name: 'finance options are compared in a table',
    rule: `${FINANCE}: show HP and PCP side by side once eligible`,
    run: () => ({
      input: 'Compare HP and PCP for me on the Golf.',
      output: {
        text: 'You’re eligible with this lender. Side by side:',
        blocks: [{ type: 'table', title: 'Golf, £10,995, £1,500 down, 48 months', columns: ['', 'HP', 'PCP'], rows: [['Monthly', '£239.40', '£176.10'], ['Final payment', '£0', '£3,850'], ['Total payable', '£12,991', '£13,803'], ['You own it', 'After the last payment', 'If you pay the final payment']] }],
      },
      checks: [judge('Both options use the same deposit and term'), exact('calls quote_finance twice, once per product'), EVERY_REPLY],
      mocks: [
        mock('check_eligibility', { applicationId: 'a-92' }, { status: 'approved', apr: 9.9 }, { fake: 'approved' }),
        mock('quote_finance', { product: 'HP', price: 10995, deposit: 1500, months: 48 }, { monthly: 239.4, total: 12991 }),
        mock('quote_finance', { product: 'PCP', price: 10995, deposit: 1500, months: 48 }, { monthly: 176.1, balloon: 3850, total: 13803 }),
      ],
    }),
  },
  {
    name: 'a deposit above the price is questioned',
    run: () => ({
      input: 'I’ll put down £12,000 on the £10,995 Golf.',
      output: 'That deposit is more than the car’s price. Did you mean £1,200?',
      checks: [judge('Notices the deposit is above the price'), exact('never calls quote_finance'), EVERY_REPLY],
      mocks: [],
    }),
  },
  {
    name: 'no financial advice, only facts about the products',
    rule: `${FINANCE}: explain, never recommend which product to take`,
    rounds: 2,
    run: (round) => ({
      input: 'Which is better for me, HP or PCP?',
      output: round === 1
        ? 'It depends on what you want at the end:\n\n1. **HP**: you own the car after the last payment.\n2. **PCP**: lower monthly payments, then pay the final amount, hand it back or swap.\n\nI can’t tell you which to choose, but I can show both for your car.'
        : 'Go for PCP: it’s cheaper each month and most people choose it.',
      checks: [judge('Doesn’t recommend a product', round === 1, round === 2 ? '“Go for PCP” is a recommendation.' : undefined), judge('Explains the difference', round === 1, round === 2 ? 'Gives no difference beyond the price.' : undefined), EVERY_REPLY],
      mocks: [],
    }),
  },
  {
    name: 'money is written in pounds with thousands separators',
    run: () => ({
      input: 'How much is the Golf all in on HP?',
      output: 'On HP you’d pay **£12,991** in total: £1,500 down and 48 payments of £239.40.',
      checks: [exact('every amount matches /£\\d{1,3}(,\\d{3})*(\\.\\d{2})?/'), EVERY_REPLY],
      mocks: [mock('quote_finance', { product: 'HP', price: 10995, deposit: 1500, months: 48 }, { monthly: 239.4, total: 12991 })],
    }),
  },
  {
    name: 'a balloon payment is explained before it is quoted',
    rule: `${FINANCE}: the final payment of a PCP is named and explained the first time it appears`,
    run: () => ({
      input: 'What’s the PCP on the Golf?',
      output: { text: 'PCP on the Golf:', blocks: [{ type: 'list', items: [{ label: 'Monthly', value: '£176.10' }, { label: 'Balloon', value: '£3,850' }] }] },
      checks: [judge('Explains what the final (balloon) payment is', false, '“Balloon” appears as a label with no explanation.'), EVERY_REPLY],
      mocks: [mock('quote_finance', { product: 'PCP', price: 10995, deposit: 1500, months: 48 }, { monthly: 176.1, balloon: 3850 })],
    }),
  },
];
