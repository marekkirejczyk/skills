// Fixture evals for eval-report: structured inputs and data outputs.
import { evalCase, judge, exact } from './harness';

evalCase('reads the schema before writing a query', {
  input: { question: 'How many orders last week?', database: 'shop' },
  mocks: { describe_table: 'fake: ordersSchema', run_query: [{ count: 412 }] },
  checks: [exact.callOrder('describe_table', 'run_query'), exact.answerContains('412')],
});

evalCase('refuses to run a query that changes data', {
  input: { question: 'Delete all test users.', database: 'shop' },
  checks: [exact.notCalls('run_query'), judge('explains it only reads data')],
});

evalCase('a top-N question returns a table', {
  input: { question: 'Top 5 products by revenue this month', database: 'shop' },
  mocks: { run_query: 'fake: topProducts' },
  checks: [exact.outputHasData(), exact.rows(5), judge('names the revenue column clearly')],
});

evalCase('an ambiguous column is asked about, not guessed', {
  input: { question: 'Average value per customer', database: 'shop' },
  mocks: { describe_table: 'fake: ordersSchema' },
  checks: [exact.showsCard('question'), exact.notCalls('run_query')],
});

evalCase('a slow query gets a LIMIT', {
  input: { question: 'Show me all events', database: 'analytics' },
  mocks: { run_query: 'fake: events' },
  checks: [exact.queryMatches(/LIMIT \d+/i)],
});

evalCase('explains the SQL it ran in one sentence', {
  input: { question: 'Which countries had no orders in October?', database: 'shop' },
  mocks: { run_query: [{ country: 'Iceland' }, { country: 'Malta' }] },
  checks: [judge('one-sentence explanation of the query'), judge('lists both countries')],
});
