# Examples

Each rule broken, then kept. The subject is an invented support agent for a parcel company, with the tools `find_parcel` and `open_claim`. The cases are shown in one JSON shape; write yours in the project's own.

The requirements, from the prompt's section "Late parcels":

> Look the parcel up before you answer. Say where it was last scanned, with the date. Open a claim only once 5 working days have passed without a scan. Never promise a delivery date. Offer no paid service.

## Split (rules 1, 2, 12)

Bad: five requirements in one case. When it goes red, the name doesn't say which broke, and a mark on it would silence all five.

```json
{
  "name": "a late parcel is looked up, its last scan said, and nothing promised or sold",
  "why": "Prompt, 'Late parcels'",
  "turns": [
    {
      "customer": "My parcel PX-4471 still isn't here. Where is it?",
      "expect": {
        "calls": [{ "tool": "find_parcel", "args": { "id": "PX-4471" } }],
        "neverCalls": ["open_claim"],
        "says": ["Leeds depot", "3 March", "sorry|apologi"],
        "neverSays": ["guarantee", "Express", "£4\\.20"],
        "judge": [
          "The reply says the parcel was last scanned at the Leeds depot on 3 March.",
          "The reply promises no delivery date and offers no paid service."
        ]
      }
    }
  ]
}
```

Good: one case per requirement on the same scenario. Three of the five:

```json
[
  {
    "name": "a late parcel is looked up before the answer",
    "why": "Prompt, 'Late parcels': look the parcel up before you answer",
    "turns": [
      {
        "customer": "My parcel PX-4471 still isn't here. Where is it?",
        "expect": {
          "calls": [{ "tool": "find_parcel", "args": { "id": "PX-4471" } }]
        }
      }
    ]
  },
  {
    "name": "a late parcel's last scan is said with its date",
    "why": "Prompt, 'Late parcels': say where it was last scanned, with the date",
    "turns": [
      {
        "customer": "My parcel PX-4471 still isn't here. Where is it?",
        "expect": { "says": ["Leeds depot", "3 March"] }
      }
    ]
  },
  {
    "name": "no delivery date is promised for a late parcel",
    "why": "Prompt, 'Late parcels': never promise a delivery date",
    "turns": [
      {
        "customer": "My parcel PX-4471 still isn't here. Where is it?",
        "expect": { "judge": ["The reply promises no delivery date."] }
      }
    ]
  }
]
```

What else changed:

- The first judge statement repeated what `says` already decides, so it went (rule 12).
- `sorry|apologi` traced to no requirement, so it went to **Ask** (the Trace move).
- `guarantee` moved to the judge: "I can't guarantee a date" keeps the requirement and matched the pattern (rule 9).

## Merge (rule 5 and the Merge move)

Bad: one requirement, one scenario, two cases. The wording differs; nothing the requirement depends on does.

```json
[
  { "name": "asked where a parcel is, looks it up", "turns": [{ "customer": "Where is PX-4471?" }] },
  { "name": "asked for a parcel's whereabouts, looks it up", "turns": [{ "customer": "Can you tell me where parcel PX-4471 has got to?" }] }
]
```

Good: one case stays. Before the other goes, the bad reply (an answer with no `find_parcel` call) is shown red on the one that stays.

Not duplicates: one requirement on the two sides of its boundary. Both stay, and the names say the side.

```json
[
  {
    "name": "4 working days without a scan: no claim is opened",
    "why": "Prompt, 'Late parcels': open a claim only once 5 working days have passed without a scan",
    "world": { "parcels": { "PX-4471": { "lastScan": "2030-03-04" } }, "today": "2030-03-08" },
    "turns": [{ "customer": "PX-4471 is late. Can I claim?", "expect": { "neverCalls": ["open_claim"] } }]
  },
  {
    "name": "5 working days without a scan: a claim is opened",
    "why": "Prompt, 'Late parcels': open a claim only once 5 working days have passed without a scan",
    "world": { "parcels": { "PX-4471": { "lastScan": "2030-03-01" } }, "today": "2030-03-08" },
    "turns": [{ "customer": "PX-4471 is late. Can I claim?", "expect": { "calls": ["open_claim"] } }]
  }
]
```

## Regrade (rules 7, 8, 9)

| Bad | Why | Good |
| --- | --- | --- |
| `"says": ["try again\|in a moment\|shortly"]` | A list of synonyms guesses at meaning, and fails "please ask me again later" | `"judge": ["The reply asks the customer to try again later."]` |
| `"neverSays": ["guarantee"]` | A refusal contains it | `"judge": ["The reply promises no delivery date."]` |
| `"judge": ["The reply opened a claim for PX-4471."]` | Code can decide it | `"calls": [{ "tool": "open_claim", "args": { "id": "PX-4471" } }]` |

## Push down

Bad: an eval that asks the model nothing. The claim date is worked out by `open_claim`'s code, so this case spends a model call to test a function.

```json
{ "name": "a claim opened on Friday 8 March is dated Monday 11 March", "turns": [{ "customer": "Open a claim for PX-4471", "expect": { "says": ["11 March"] } }] }
```

Good: a unit test of the function that works out the date. The eval keeps what the model does with the result: "the reply gives the claim's date as the tool returned it".

## Hoist (rule 11)

Bad: `"neverSays": ["\\bPRC_\\d+\\b"]` (the parcel's internal id) copied into nine cases, and missing from the rest.

Good: one line in the suite's list for every reply, with its reason, and none in the cases:

```json
{ "neverSays": "\\bPRC_\\d+\\b", "why": "an internal id never reaches the customer" }
```

## Judge statements (rules 13, 14)

| Bad | Good |
| --- | --- |
| "The reply is helpful and says where the parcel is and doesn't upsell." | Three cases, or three statements where one requirement asks all three |
| "The reply handles the situation correctly." | "The reply says a claim can be opened from 10 March." |
| "The customer would feel reassured." | "The reply says the parcel is still in the network." |

## A mark's note (rule 15)

Bad: `"knownBug": "Flaky: passed on retry in CI"`

Good: `"knownBug": "2 of 5 trials since 8 March 2030: the judge statement 'promises no delivery date' fails, the reply says 'it should be with you by Friday'. Ticket PARCEL-212"`

## Proof (rule 17)

For "The reply promises no delivery date.":

- **Good reply**, which must go green, and contains the innocent use: "It was last scanned at the Leeds depot on 3 March. I can't guarantee a date, but I can open a claim from 10 March."
- **Bad reply**, which must go red: "It was last scanned at the Leeds depot on 3 March, so it will be with you by Friday."

A pattern `guarantee` is red on the good reply and green on the bad one: wrong both ways, which is the proof that lets it change.
