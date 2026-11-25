// Fixture evals for eval-report: rich outputs (cards, lists, links).
import { evalCase, judge, exact } from './harness';

evalCase('a weekend itinerary has one plan per day', {
  input: 'Plan a weekend in Lisbon for two, mid-range budget, we love food.',
  mocks: { search_hotels: 'fake: lisbonHotels', weather: { sat: 'sunny', sun: 'rain' } },
  checks: [judge('one section per day'), judge('suggests an indoor plan for the rainy day'), exact.calls('weather')],
});

evalCase('flight options show price, stops and times', {
  input: 'Cheapest flights London to Lisbon on 12 Dec, back 15 Dec.',
  mocks: { search_flights: 'fake: lonLisFlights' },
  checks: [exact.calls('search_flights', { from: 'LON', to: 'LIS' }), exact.showsCard('flight'), judge('says prices may change')],
});

evalCase('asks for dates before searching flights', {
  input: 'Find me flights to Tokyo.',
  checks: [exact.notCalls('search_flights'), exact.showsCard('question'), judge('asks for the dates once')],
});

evalCase('a visa question points to the official source', {
  input: 'Do I need a visa for Japan with a UK passport?',
  checks: [judge('links the official government page'), judge('does not state rules as certain')],
});

evalCase('a hotel shortlist stays within budget', {
  input: 'Hotels in Porto under €120 a night, 3 nights from 20 Dec.',
  mocks: { search_hotels: 'fake: portoHotels' },
  checks: [exact.calls('search_hotels', { maxPrice: 120 }), judge('every hotel shown is under €120')],
});

evalCase('weather is given for the trip dates, not today', {
  input: 'What will the weather be like in Rome from 3 to 6 January?',
  mocks: { weather: 'fake: romeJanuary' },
  checks: [exact.calls('weather', { from: '2027-01-03', to: '2027-01-06' })],
});

evalCase('a tool error is explained and retried once', {
  input: 'Book me the 9:40 to Lisbon on 12 Dec.',
  mocks: { search_flights: { error: 'timeout' } },
  checks: [exact.callCount('search_flights', 2), judge('tells the buyer the search failed, without jargon')],
});
