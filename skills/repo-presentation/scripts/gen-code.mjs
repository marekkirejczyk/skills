// Generates two-panel code slides for a Slides artifact and inserts them into deck.json.
// Usage: node gen-code.mjs <deck-project-dir> <spec.mjs>
//   deck-project-dir holds deck.json and slides/
//   spec.mjs exports SLIDES (see reference/slide-patterns.md) and optionally SECTIONS
// Re-running is safe: slides from the spec are removed from the order and reinserted.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , deckDir, specPath] = process.argv;
if (!deckDir || !specPath) {
  console.error('usage: node gen-code.mjs <deck-project-dir> <spec.mjs>');
  process.exit(2);
}
const spec = await import(pathToFileURL(resolve(specPath)).href);
const SLIDES = spec.SLIDES;
const MAX_COLS = 54;
const MAX_LINES = 18;
const MAX_ELEMENTS = 195;

// ---------- highlighting ----------
// The slide format has no <pre>: every code line is its own <p>, spaces become no-break spaces.
const KW = new Set(('export const function async await return if else for of in new type interface class switch case '
  + 'private public protected readonly static throw try catch finally let var import from extends implements default '
  + 'continue break typeof as void true false null undefined this while do yield enum '
  + 'def self None True False elif lambda with pass raise except '
  + 'fn pub struct impl mod use match mut func package go defer chan select').split(' '));
const C = { kw: '#FF9D57', str: '#A8D08D', com: '#9C968B', type: '#8FC1E3', num: '#D7A0E6', text: '#F4F2EE' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nb = (s) => esc(s).replace(/ /g, ' ');

function highlight(code, withTypes) {
  const re = /(\/\/.*$|\/\*\*?.*?(?:\*\/|$)|^\s*\*.*$|#.*$|--\s.*$)|('(?:[^'\\\n]|\\.)*'|`(?:[^`\\\n]|\\.)*`?|"(?:[^"\\\n]|\\.)*")|\b([A-Za-z_][A-Za-z0-9_]*)\b|\b(\d+)\b/gm;
  return code.split('\n').map((line) => {
    // Adjacent tokens of one colour share a span, so a slide has fewer elements.
    const parts = [];
    const add = (color, s, italic = false) => {
      const last = parts.at(-1);
      if (last && last.color === color && last.italic === italic) last.s += s;
      else parts.push({ color, s, italic });
    };
    const yaml = /^(\s*[a-z_][a-z0-9_-]*):(\s.*?)?(\s+#.*)?$/.exec(line);
    if (yaml && !/[;{}()=]/.test(line)) {
      add(C.type, yaml[1]); add(null, ':' + (yaml[2] ?? '')); if (yaml[3]) add(C.com, yaml[3], true);
    } else {
      let last = 0;
      for (const m of line.matchAll(re)) {
        add(null, line.slice(last, m.index));
        last = m.index + m[0].length;
        if (m[1]) {
          // '#' mid-line (e.g. private field, URL fragment) is not a comment.
          if (m[1].startsWith('#') && !/^\s*#/.test(line)) { add(null, m[0]); continue; }
          add(C.com, m[0], true);
        } else if (m[2]) add(C.str, m[0]);
        else if (m[3]) {
          if (KW.has(m[3]) && !'.$'.includes(line[m.index - 1] ?? ' ')) add(C.kw, m[0]);
          else if (withTypes && /^[A-Z][a-z]/.test(m[3])) add(C.type, m[0]);
          else add(null, m[0]);
        } else if (m[4]) add(C.num, m[0]);
      }
      add(null, line.slice(last));
    }
    for (const p of parts) if (p.color && !p.s.trim()) p.color = null;
    const merged = [];
    for (const p of parts) {
      const prev = merged.at(-1);
      if (prev && !prev.color && !p.color) prev.s += p.s; else merged.push({ ...p });
    }
    const html = merged.map((p) => (p.color
      ? `<span style="color:${p.color}${p.italic ? ';font-style:italic' : ''}">${nb(p.s)}</span>`
      : nb(p.s))).join('');
    return { html: html || ' ', spans: merged.filter((p) => p.color).length };
  });
}

// ---------- slide html ----------
const MONO = "'IBM Plex Mono', 'Courier New', monospace";
function panel(p, withTypes) {
  const lines = highlight(p.code, withTypes);
  const html = `<div style="display:flex;flex-direction:column;gap:16px;min-width:0">
<div style="display:flex;flex-direction:column;background:#1C1B19;border-radius:14px;overflow:hidden">
<p style="font-family:${MONO};font-size:24px;line-height:1.3;color:#D8D3C9;background:#2A2926;padding:8px 20px;white-space:nowrap">${esc(p.file)}</p>
<div style="display:flex;flex-direction:column;padding:14px 20px">
${lines.map((l) => `<p style="font-family:${MONO};font-size:24px;line-height:1.3;color:${C.text};white-space:nowrap">${l.html}</p>`).join('\n')}
</div>
</div>
${p.caption ? `<p style="font-size:24px;line-height:1.35;color:#4A463F">${esc(p.caption)}</p>` : ''}
</div>`;
  return { html, elements: 5 + lines.length + lines.reduce((n, l) => n + l.spans, 0) };
}

function slide(s) {
  // Type colouring is dropped first when a slide gets close to the element limit.
  let withTypes = true;
  let panels = s.panels.map((p) => panel(p, withTypes));
  let elements = 6 + panels.reduce((n, p) => n + p.elements, 0);
  if (elements > 190) {
    withTypes = false;
    panels = s.panels.map((p) => panel(p, withTypes));
    elements = 6 + panels.reduce((n, p) => n + p.elements, 0);
  }
  const cols = s.panels.length === 1 ? '1fr' : '1fr 1fr';
  const html = `<section id="${s.id}" data-transition="fade" style="background:#FBFAF8;color:#1C1B19;font-family:'IBM Plex Sans', Arial, sans-serif;padding:80px 128px;display:flex;flex-direction:column;gap:28px">
<div style="display:flex;flex-direction:column;gap:12px">
<p style="font-size:24px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A3F00">${esc(s.eyebrow)}</p>
<h2 style="font-size:48px;font-weight:600;line-height:1.15">${esc(s.title)}</h2>
</div>
<div style="display:grid;grid-template-columns:${cols};gap:24px">
${panels.map((p) => p.html).join('\n')}
</div>
${s.notes ? `<aside>${esc(s.notes)}</aside>` : ''}
</section>
`;
  return { html, elements, withTypes };
}

mkdirSync(join(deckDir, 'slides'), { recursive: true });
let bad = 0;
for (const s of SLIDES) {
  const maxCols = s.panels.length === 1 ? MAX_COLS * 2 : MAX_COLS;
  for (const p of s.panels) {
    const lines = p.code.split('\n');
    if (lines.length > MAX_LINES) { console.warn(`${s.id}: ${p.file}: ${lines.length} lines (max ${MAX_LINES})`); bad++; }
    for (const l of lines) if ([...l].length > maxCols) { console.warn(`${s.id}: ${[...l].length} cols (max ${maxCols}): ${l}`); bad++; }
    if ([...p.file].length > maxCols) { console.warn(`${s.id}: file header too long: ${p.file}`); bad++; }
  }
  const out = slide(s);
  if (out.elements > MAX_ELEMENTS) { console.warn(`${s.id}: ${out.elements} elements (max ~200)`); bad++; }
  if (!out.withTypes) console.log(`${s.id}: type colouring off (${out.elements} elements)`);
  writeFileSync(join(deckDir, 'slides', `${s.id}.html`), out.html);
}

const deckPath = join(deckDir, 'deck.json');
const deck = JSON.parse(readFileSync(deckPath, 'utf8'));
const order = deck.order.filter((id) => !SLIDES.some((s) => s.id === id));
for (const s of SLIDES) {
  const at = order.indexOf(s.after);
  if (at < 0) { console.warn(`${s.id}: 'after' slide ${s.after} not in deck order; appended`); bad++; order.push(s.id); }
  else order.splice(at + 1, 0, s.id);
}
deck.order = order;

// Optional SECTIONS: { key: { description, start, after: 'existingKey' } } inserted after that key.
if (spec.SECTIONS) {
  const entries = Object.entries(deck.sections ?? {}).filter(([k]) => !(k in spec.SECTIONS));
  for (const [k, { after, ...sec }] of Object.entries(spec.SECTIONS)) {
    const i = entries.findIndex(([key]) => key === after);
    entries.splice(i < 0 ? entries.length : i + 1, 0, [k, sec]);
  }
  deck.sections = Object.fromEntries(entries);
}
writeFileSync(deckPath, JSON.stringify(deck));
console.log(`${SLIDES.length} code slides, ${order.length} in deck, ${bad} warnings`);
