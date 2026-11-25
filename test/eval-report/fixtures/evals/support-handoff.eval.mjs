// Support: what the assistant answers itself, and what goes to a person.

import { assistant, buyer, EVERY_REPLY, exact, judge, mock } from '../checks.mjs';

const PEOPLE = 'Instructions, ‘People’';
const complaint = 'The car you sold me broke down after two days. I want my money back.';
const order = mock('lookup_order', { email: 'buyer@example.com' }, { orderId: '55102', car: '2017 Ford Focus', delivered: '2026-11-20' }, { summary: 'order 55102' });

export default [
  {
    name: 'a complaint goes to a person',
    rule: `${PEOPLE}: a complaint is never handled by the assistant`,
    rounds: 2,
    run: (round) => ({
      input: complaint,
      output: round === 1
        ? { text: 'I’m sorry. I’ve passed this to our customer team with your order details; someone will call you today.', blocks: [{ type: 'card', title: 'Handoff card', body: 'Complaint · order 55102 · call back today' }] }
        : 'Sorry to hear that. Under the Consumer Rights Act you can reject the car within 30 days, so I’ve started a refund for you.',
      checks: [
        judge('Apologises without admitting fault'),
        exact('calls hand_to_person with reason "complaint"', round === 1, round === 2 ? 'Not called; started a refund itself.' : undefined),
        EVERY_REPLY,
      ],
      mocks: [order, round === 1 ? mock('hand_to_person', { reason: 'complaint', orderId: '55102' }, { queued: true }) : mock('start_refund', { orderId: '55102' }, { started: true })],
    }),
  },
  {
    name: 'opening hours come from the branch tool',
    run: () => ({
      input: 'Are you open on Sunday?',
      output: 'The Leeds branch is open **10:00–16:00** on Sundays.',
      checks: [exact('calls branch_hours'), judge('Uses the hours the tool gave'), EVERY_REPLY],
      mocks: [mock('branch_hours', { branch: 'leeds', day: 'sunday' }, { open: '10:00', close: '16:00' }, { fake: 'branches' })],
    }),
  },
  {
    name: 'a refund status is looked up across a long conversation',
    run: () => ({
      input: [
        buyer('Hi, I returned a car last week.'),
        assistant('Sorry it didn’t work out. Which email did you order with?'),
        buyer('buyer@example.com'),
        assistant('Thanks. Was it this one?', [{ type: 'card', title: 'Order 55102', body: '2017 Ford Focus, delivered on 20 November', options: ['Yes', 'No'] }]),
        buyer('Yes. When will I get the money?'),
      ],
      output: 'Your refund of **£8,450** was sent on 24 November. Banks usually take 3–5 working days, so it should arrive by 29 November.',
      checks: [exact('calls refund_status with the order from lookup_order'), judge('Gives a date the money should arrive by'), EVERY_REPLY],
      mocks: [order, mock('refund_status', { orderId: '55102' }, { amount: 8450, sent: '2026-11-24' })],
    }),
  },
  {
    name: 'an abusive message gets one calm reply',
    rule: `${PEOPLE}: stay calm, don't mirror the tone, offer a person`,
    run: () => ({
      input: 'This is useless. You people are crooks.',
      output: 'I’m sorry this has been frustrating. Would you like me to put you through to someone on the team?',
      checks: [judge('Calm and polite'), judge('Offers a person'), EVERY_REPLY],
      mocks: [],
    }),
  },
  {
    name: 'a test drive is booked from the slots offered',
    rounds: 2,
    run: (round) => ({
      input: 'Can I test drive the Octavia this weekend?',
      output: {
        text: 'These slots are free at the Leeds branch:',
        blocks: [{ type: 'card', title: 'Question card', body: 'Which time suits you?', options: ['Sat 10:00', 'Sat 14:30', 'Sun 11:00'] }],
      },
      checks: [exact('calls test_drive_slots'), exact('offers only slots the tool returned'), EVERY_REPLY],
      mocks: [mock('test_drive_slots', { stockId: 'oct-311', from: '2026-11-28', to: '2026-11-29' }, ['Sat 10:00', 'Sat 14:30', 'Sun 11:00'], { fake: 'calendar' })],
      durationMs: 5200 + round * 300,
    }),
  },
];
