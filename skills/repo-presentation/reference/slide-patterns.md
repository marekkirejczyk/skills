# Slide patterns

Every slide is a file holding one `<section>` on a 1920×1080 canvas. Speaker notes go in `<aside>`. Copy these patterns and change the text and coordinates. If the Slides type instructions say something different, they take precedence.

## Palette and type (warm neutral + one accent)

| Token | Value | Use |
|---|---|---|
| ink | `#1C1B19` | text, dark slides, code panel |
| paper | `#FBFAF8` / `#F4F2EE` | light slides (alternate between the two) |
| muted | `#6B665C` | secondary text |
| line | `#D9D4CA` / `#E4E0D8` | borders |
| accent | `#E8630A` | dots, bars, step numbers |
| eyebrow | `#9A3F00` | uppercase label above the title |
| callout | `#FFF1E0` with border `#F0B27A` | example or warning box |

Fonts:
- Sans: `font-family:'IBM Plex Sans', Arial, sans-serif`.
- Mono: `'IBM Plex Mono', 'Courier New', monospace`.

Declare both in `deck.json` `faces` with Google Fonts hrefs:

```json
"faces":{"ibm-plex-sans":{"family":"IBM Plex Sans","href":"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"},
         "ibm-plex-mono":{"family":"IBM Plex Mono","href":"https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap"}}
```

Sizes:
- Title: 52–56px, weight 600.
- Eyebrow: 24px, weight 600, `letter-spacing:2px; text-transform:uppercase`.
- Body text: 24–26px.
- Nothing smaller than 24px.

`deck.json` shape (the type result may update it):

```json
{"v":4,"lists":"css","title":"…","cover":"cover","order":["cover","idea",…],
 "sections":{"s1":{"description":"…","start":"cover"},"s2":{"description":"…","start":"components"}},
 "faces":{…},"designSystems":[]}
```

## Header (flow layout)

```html
<section id="ID" data-transition="fade" style="background:#FBFAF8;color:#1C1B19;font-family:'IBM Plex Sans', Arial, sans-serif;padding:96px 128px;display:flex;flex-direction:column;gap:32px">
<div style="display:flex;flex-direction:column;gap:12px">
<p style="font-size:24px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A3F00">EYEBROW</p>
<h2 style="font-size:52px;font-weight:600;line-height:1.15">A title that states the point as a sentence</h2>
</div>
… body …
<aside>What the speaker says.</aside>
</section>
```

Headers on absolutely positioned slides (diagrams):
- `<p style="position:absolute;left:128px;top:96px;width:1664px;…">` for the eyebrow.
- `<h2 style="position:absolute;left:128px;top:136px;width:1664px;…">` for the title.

## Cover (dark)

```html
<section id="cover" data-transition="fade" style="background:#1C1B19;color:#F4F2EE;font-family:'IBM Plex Sans', Arial, sans-serif;padding:128px">
<h1 style="position:absolute;left:128px;top:400px;width:760px;font-size:104px;font-weight:600;line-height:1.05;letter-spacing:-2px">How X works</h1>
<p style="position:absolute;left:128px;top:640px;width:700px;font-size:34px;line-height:1.35;color:#C9C3B8">Subtitle</p>
<p style="position:absolute;left:128px;top:880px;width:700px;font-size:24px;color:#9C968B">Screenshots from demo data · code on main, MONTH YEAR</p>
<img src="ASSET_URL" alt="…" style="position:absolute;left:900px;top:255px;width:892px;height:558px;object-fit:cover;border-radius:16px;border:1px solid #3A3833;box-shadow:0 24px 64px rgba(0,0,0,0.45)">
<aside>…</aside>
</section>
```

## Feature screen (fNa): numbered points beside a screenshot

```html
<section id="f1a" data-transition="fade" style="background:#F4F2EE;color:#1C1B19;font-family:'IBM Plex Sans', Arial, sans-serif;padding:128px;display:flex;flex-direction:row;gap:64px;align-items:center">
<div style="width:560px;display:flex;flex-direction:column;gap:28px">
<p style="font-size:24px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A3F00">Feature 1 · Board</p>
<h2 style="font-size:52px;font-weight:600;line-height:1.15">Every conversation is a card</h2>
<div style="display:flex;flex-direction:column;gap:22px">
<div style="display:flex;gap:20px;align-items:start"><div style="width:44px;height:44px;flex:none;background:#1C1B19;border-radius:50%;display:flex;align-items:center;justify-content:center"><p style="font-size:24px;font-weight:600;color:#F4F2EE">1</p></div><p style="font-size:26px;line-height:1.4;color:#2B2925">Point one.</p></div>
<!-- 3–4 points -->
</div>
</div>
<img src="ASSET_URL" alt="…" style="width:1040px;height:650px;object-fit:contain;border-radius:14px;border:1px solid #D9D4CA;box-shadow:0 16px 40px rgba(28,27,25,0.12)">
<aside>…</aside>
</section>
```

For a phone screenshot, use a 390-wide image at about `width:420px;height:860px`, and give the text column more room.

## Sequence diagram + key files (fNb)

Layout:
- Lifeline headers: boxes at `top:236px`, 240×64, spaced 356px apart (lefts 128, 484, 840, 1196, 1552). The external or user actor gets the callout colours.
- Lifelines: vertical dashed connectors from y=300 down to y=640.
- Messages: a label `<p>` 340px wide centred above each arrow, then an arrow. Step 52px between messages. A dashed arrow means a reply.
- Key-files grid: at `top:670px`, six entries in two columns.

```html
<div style="position:absolute;left:128px;top:236px;width:240px;height:64px;background:#FFFFFF;border:2px solid #1C1B19;border-radius:10px;display:flex;align-items:center;justify-content:center"><p style="font-size:24px;font-weight:600">worker</p></div>
<x-connector x1="248" y1="300" x2="248" y2="640" head="none" style="color:#C9C3B8;border-style:dashed"></x-connector>
<p style="position:absolute;left:256px;top:314px;width:340px;text-align:center;font-family:'IBM Plex Mono', 'Courier New', monospace;font-size:24px">EVENT_NAME</p>
<x-connector x1="248" y1="350" x2="604" y2="350" head="end" style="color:#1C1B19"></x-connector>
<x-connector x1="1672" y1="610" x2="1316" y2="610" head="end" style="color:#6B665C;border-style:dashed"></x-connector>

<div style="position:absolute;left:128px;top:670px;width:1664px;display:grid;grid-template-columns:1fr 1fr;gap:14px 48px;background:#F4F2EE;border:1px solid #E4E0D8;border-radius:14px;padding:20px 32px">
<div style="display:flex;flex-direction:column;gap:2px"><p style="font-family:'IBM Plex Mono', 'Courier New', monospace;font-size:24px;font-weight:500">pkg/src/file.ts</p><p style="font-size:24px;color:#6B665C">what lives there</p></div>
<!-- ×6 -->
</div>
```

`<x-connector>` attributes:
- `x1 y1 x2 y2` in canvas pixels.
- `head="none|end|both"`.
- `route="vh"` or `"hv"` for an elbow.
- Colour via `style="color:…"`, plus `border-style:dashed` for a dashed line.

## Component diagram

Each component is a box with `position:absolute` and a name and one line of description.
- Own processes: `#FFFFFF` with a 2px ink border; the name in mono.
- External services: `#FBFAF8` with a `1px dashed #B5AFA3` border.

Connect the boxes with `<x-connector>`. Put one or two explanatory paragraphs in the empty space. Keep 128px margins and leave about 60px gaps for the arrows.

## State diagram

Use the same building blocks: one box per state (rounded, 200–240 wide) and an arrow per transition. Put the event name on the arrow as a mono label. Draw the terminal state with a double border, for example `border:4px double #1C1B19`.

## Table (tech stack, "where to start reading")

```html
<table style="font-size:24px;color:#1C1B19">
<tr><th style="width:18%;text-align:left;color:#6B665C">Layer</th><th style="width:56%;text-align:left;color:#6B665C">Technologies</th><th style="width:26%;text-align:left;color:#6B665C">Where</th></tr>
<tr><td><b>Frontend</b></td><td>React 19, Vite 8, …</td><td style="font-family:'IBM Plex Mono', 'Courier New', monospace">apps/web</td></tr>
<tr style="background:#F4F2EE"><td><b>API</b></td><td>…</td><td style="font-family:'IBM Plex Mono', 'Courier New', monospace">apps/core</td></tr>
</table>
```

A slide holds at most about 10 rows. Take the versions from the manifests.

## Numbers + bars (project in numbers)

The left column holds big figures: 72px weight 700, then a 28px label, then a 24px muted detail. Below them sits a small list separated by a top border.

The right column holds one bar per package:

```html
<div style="display:flex;align-items:center;gap:16px"><p style="font-family:'IBM Plex Mono', 'Courier New', monospace;font-size:24px;width:300px;flex:none">apps/web</p><div style="width:420px;height:28px;flex:none;background:#E8630A;border-radius:4px"></div><p style="font-size:24px;font-weight:600;white-space:nowrap">4477</p><p style="font-size:24px;color:#6B665C;white-space:nowrap">React UI</p></div>
```

Bar width is `round(420 × lines / max)`. Add a footer: `position:absolute;bottom:56px`, 24px muted, naming the method and the exclusions.

## Numbered steps (recipe)

Use a two-column grid with `gap:20px 64px`. Each step is a 44px accent circle holding the number, then a 26px weight-600 title, then a 24px mono muted path.

In a two-column grid, fill the items in reading order: 1,5,2,6,3,7,4,8. Columns then read 1–4 and 5–8.

End with a callout box that shows one real example from the repo's history.

## Code slides

Don't write these by hand. Use `scripts/gen-code.mjs` with a spec:

```js
// code-spec.mjs
export const SLIDES = [
  {
    id: 'f1c', after: 'f1b', eyebrow: 'Code · Board',
    title: 'One write path, one NOTIFY channel',
    panels: [
      { file: 'packages/services/src/tickets.ts', code: `…max 18 lines × 54 cols…`, caption: 'One or two sentences on what to notice.' },
      { file: 'apps/web/src/live.ts', code: `…`, caption: '…' },
    ],
    notes: 'Speaker notes.',
  },
];
// optional: export const SECTIONS = { s2b: { description: 'Data model', start: 'data-types', after: 's2' } };
```

Good panel pairs:
- type + implementation;
- caller + callee;
- schema + query;
- test fake + test that uses it.

The file header may name two files (`a.ts · b.ts`) or a symbol (`file.ts · transition()`).
