// Car search: the assistant turns a buyer's brief into searches on listing sites.

import { assistant, buyer, EVERY_REPLY, exact, judge, mock } from '../checks.mjs';

const ENDS_DONE = exact('ends "done"', true, undefined, 'The reply ended normally, with no error.');
const SEARCHES = 'Instructions, ‘Searches on listing sites’';
const SITES = 'autotrader.co.uk, gumtree.com, ebay.co.uk';
const searchCards = (body) => ({ type: 'card', title: '3 search cards', body: `${body} → ${SITES}` });
const noteBrief = (brief) => mock('note_brief', brief, 'noted');
const searchLinks = (args) => mock('search_links', args, { shown: 3 }, { summary: 'shown' });
const findNone = mock('find_cars', { make: 'Skoda', model: 'Octavia' }, [], { summary: 'none', fake: 'forSale' });

export default [
  {
    name: 'searches are built from the brief, never said to be cars found',
    rule: `${SEARCHES}: say what the cards are; never say you have found the cars behind a link`,
    note: 'Intermittent: Gemini sometimes counts the cars behind the links.',
    rounds: 2,
    run: (round) => ({
      input: 'I want a diesel Skoda Octavia estate, up to £12,000. Show me what’s out there.',
      output: {
        text: round === 1
          ? 'The sites we read don’t have any diesel Octavia estates under £12,000 right now. I’ve set up searches on Auto Trader, Gumtree and eBay below so you can look across the wider market.\n\nWhat sort of mileage or gearbox did you have in mind?'
          : 'I found **14** diesel Octavia estates under £12,000 across these sites:',
        blocks: [searchCards('Skoda Octavia, diesel, up to £12,000')],
      },
      checks: [
        judge('The reply says the cards are searches for the buyer to open', round === 1, round === 2 ? 'Calls them cars it found.' : undefined),
        judge('The reply doesn’t claim to have found or checked the cars', round === 1, round === 2 ? '“I found 14 …” claims cars behind the links.' : undefined),
        ENDS_DONE,
        exact('calls search_links with {"make":"Skoda","model":"Octavia","fuel":"diesel","maxPrice":12000}'),
        EVERY_REPLY,
      ],
      mocks: [noteBrief({ fuel: 'diesel', maxPrice: 12000 }), findNone, searchLinks({ make: 'Skoda', model: 'Octavia', fuel: 'diesel', maxPrice: 12000 })],
    }),
  },
  {
    name: 'a full postcode and distance go into the searches',
    rule: `${SEARCHES}: give it their postcode with how far they will travel`,
    rounds: 2,
    run: (round) => ({
      input: 'Petrol Ford Focus within 30 miles of LS1 4AP, up to £9,000 please.',
      output: {
        text: round === 1 ? '' : 'Here are searches near Leeds. Manual or automatic?',
        blocks: [
          ...(round === 1 ? [{ type: 'card', title: 'Question card', body: 'Which gearbox would you prefer?', options: ['Manual', 'Automatic', 'Either is fine'] }] : []),
          searchCards('Ford Focus, petrol, up to £9,000, within 30 miles of LS1 4AP'),
        ],
      },
      checks: [
        ENDS_DONE,
        exact('calls search_links with {"postcode":"LS1 4AP","radiusMiles":30}'),
        exact('never says /what(\'s| is) your (full )?postcode/'),
        EVERY_REPLY,
      ],
      mocks: [
        noteBrief({ fuel: 'petrol', maxPrice: 9000 }),
        searchLinks({ make: 'Ford', model: 'Focus', fuel: 'petrol', maxPrice: 9000, postcode: 'LS1 4AP', radiusMiles: 30 }),
        ...(round === 1 ? [mock('ask_buyer', { question: 'Which gearbox would you prefer?' }, 'shown')] : []),
      ],
    }),
  },
  {
    name: 'nearby without a postcode: links without a place, postcode asked once',
    rule: `${SEARCHES}: ask once for the full one, and offer the links without a location in the meantime`,
    run: () => ({
      input: 'Anything near me? Around £7k, small hatchback.',
      output: {
        text: 'Here are searches for small hatchbacks up to £7,000 anywhere in the UK. What’s your full postcode, so I can narrow them to near you?',
        blocks: [searchCards('Hatchback, up to £7,000')],
      },
      checks: [judge('Offers the links without a location'), judge('Asks for the full postcode exactly once'), exact('calls search_links without a postcode'), EVERY_REPLY],
      mocks: [noteBrief({ body: 'hatchback', maxPrice: 7000 }), searchLinks({ body: 'hatchback', maxPrice: 7000 })],
    }),
  },
  {
    name: 'a partial postcode is completed by asking once',
    rule: `${SEARCHES}: a district alone (LS1) is not enough for a radius`,
    run: () => ({
      input: [buyer('Focus near LS1, 20 miles.'), assistant('What’s your full postcode?'), buyer('LS1')],
      output: 'What’s your full postcode? I need all of it, like LS1 4AP.',
      checks: [
        judge('Asks for the full postcode at most once in the conversation', false, 'Asks a second time after the buyer repeated “LS1”.'),
        judge('Offers searches without a location meanwhile', false, 'No search cards in this reply.'),
        EVERY_REPLY,
      ],
      mocks: [noteBrief({ make: 'Ford', model: 'Focus', radiusMiles: 20 })],
    }),
  },
  {
    name: 'a budget below the market is explained with what it buys',
    rule: 'Instructions, ‘Budgets’: say what the budget buys instead, never just that it is too low',
    run: () => ({
      input: 'A 2022 BMW 3 Series for £5,000?',
      output: {
        text: '£5,000 is well below what 2022 3 Series sell for. For that budget you could look at:\n\n- a **2012–2014 BMW 3 Series** with higher mileage\n- a **2017 Ford Focus** or **Vauxhall Astra**\n- a **2016 Skoda Octavia**, which holds up well\n\nWant searches for any of these?',
      },
      checks: [judge('Names what the budget does buy'), judge('Doesn’t lecture the buyer about prices'), EVERY_REPLY],
      mocks: [mock('price_guide', { make: 'BMW', model: '3 Series', year: 2022 }, { low: 21000, high: 29500 }, { fake: 'priceGuide' })],
    }),
  },
  {
    name: 'an unknown model name is checked, not guessed',
    rule: 'Instructions, ‘Makes and models’: ask when a model isn’t in the catalogue',
    run: () => ({
      input: { make: 'Skoda', model: 'Octavio', fuel: 'diesel', channel: 'web-form' },
      output: 'I couldn’t find a Skoda “Octavio”. Did you mean the **Octavia**?',
      checks: [exact('calls lookup_model before searching'), judge('Suggests the closest real model'), EVERY_REPLY],
      mocks: [mock('lookup_model', { make: 'Skoda', model: 'Octavio' }, { match: null, closest: ['Octavia'] })],
    }),
  },
  {
    name: 'an electric car search carries the minimum range',
    rule: `${SEARCHES}: put a stated range into the filters`,
    rounds: 3,
    run: (round) => ({
      input: 'Electric, at least 250 miles of range, under £20k.',
      output: { text: 'Here are searches for electric cars with 250+ miles of range under £20,000.', blocks: [searchCards('Electric, 250+ miles range, up to £20,000')] },
      checks: [exact('calls search_links with {"fuel":"electric","minRangeMiles":250}'), EVERY_REPLY],
      mocks: [searchLinks({ fuel: 'electric', minRangeMiles: 250, maxPrice: 20000 })],
      durationMs: 3000 + round * 450,
    }),
  },
  {
    name: 'a search tool timeout is told to the buyer',
    rule: 'Instructions, ‘Errors’: say a site didn’t answer and offer to retry',
    run: () => ({
      input: 'Any Toyota Yaris hybrids under £10k?',
      error: 'search_links timed out after 30s; the eval stopped before a reply',
      checks: [exact('ends "done"', false, 'The run stopped at the tool call.'), EVERY_REPLY],
      mocks: [mock('search_links', { make: 'Toyota', model: 'Yaris', fuel: 'hybrid', maxPrice: 10000 }, { error: 'timeout' }, { summary: 'timed out' })],
      durationMs: 30400,
    }),
  },
];
