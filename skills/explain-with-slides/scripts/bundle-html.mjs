// Bundles deck.json + slides/*.html into one standalone deck.html, for agents without
// a Slides artifact runtime (Codex, Antigravity, …). Open the file in any browser.
// Usage: node bundle-html.mjs <deck-project-dir> [out.html]
// Keys: → / Space / click = next, ← = back, Home/End, N = speaker notes, F = fullscreen.
// <x-connector> elements become inline SVG arrows. Image src paths stay as written,
// so use paths relative to the output file (e.g. ../shots/png/board.png).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [, , deckDir, outArg] = process.argv;
if (!deckDir) {
  console.error('usage: node bundle-html.mjs <deck-project-dir> [out.html]');
  process.exit(2);
}
const out = resolve(outArg ?? join(deckDir, 'deck.html'));
const deck = JSON.parse(readFileSync(join(deckDir, 'deck.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function connector(attrs) {
  const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(a[k] ?? 0));
  const color = /color:\s*([^;"]+)/.exec(a.style ?? '')?.[1]?.trim() ?? '#1C1B19';
  const dashed = /border-style:\s*dashed/.test(a.style ?? '');
  const mx = Math.round((x1 + x2) / 2);
  const d = a.route === 'elbow' ? `M${x1},${y1} H${mx} V${y2} H${x2}`
    : a.route === 'vh' ? `M${x1},${y1} V${y2} H${x2}`
    : a.route === 'hv' ? `M${x1},${y1} H${x2} V${y2}` : `M${x1},${y1} L${x2},${y2}`;
  const head = a.head ?? 'end';
  const id = `m${Math.random().toString(36).slice(2, 8)}`;
  return `<svg style="position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:visible;pointer-events:none" viewBox="0 0 1920 1080">`
    + `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker></defs>`
    + `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5"${dashed ? ' stroke-dasharray="8 6"' : ''}`
    + `${head === 'end' || head === 'both' ? ` marker-end="url(#${id})"` : ''}${head === 'start' || head === 'both' ? ` marker-start="url(#${id})"` : ''}/></svg>`;
}

const slides = deck.order.map((id) => {
  const html = readFileSync(join(deckDir, 'slides', `${id}.html`), 'utf8');
  return html.replace(/<x-connector([^>]*)>\s*<\/x-connector>/g, (_, attrs) => connector(attrs));
});
const fonts = Object.values(deck.faces ?? {}).map((f) => `<link rel="stylesheet" href="${esc(f.href)}">`).join('\n');

writeFileSync(out, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(deck.title ?? 'Deck')}</title>
${fonts}
<style>
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:#111;overflow:hidden}
#stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center}
section{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden}
section:not(.on){display:none!important}
section aside{display:none}
td,th{padding:10px 14px;vertical-align:top}
table{border-collapse:collapse;width:100%}
#notes{position:fixed;left:0;right:0;bottom:0;max-height:35%;overflow:auto;background:#1C1B19ee;color:#F4F2EE;font:18px/1.5 system-ui,sans-serif;padding:16px 24px;display:none}
#count{position:fixed;right:12px;bottom:8px;color:#888;font:13px system-ui,sans-serif}
</style></head><body>
<div id="stage">
${slides.join('\n')}
</div>
<div id="notes"></div><div id="count"></div>
<script>
const s=[...document.querySelectorAll('#stage > section')];let i=Math.max(0,Math.min(s.length-1,(+location.hash.slice(1)||1)-1));
const notes=document.getElementById('notes'),count=document.getElementById('count'),stage=document.getElementById('stage');
function fit(){const k=Math.min(innerWidth/1920,innerHeight/1080);stage.style.transform='translate(-50%,-50%) scale('+k+')'}
function show(){s.forEach((e,j)=>e.classList.toggle('on',j===i));const a=s[i].querySelector('aside');notes.textContent=a?a.textContent:'';count.textContent=(i+1)+' / '+s.length;history.replaceState(null,'','#'+(i+1))}
function go(d){i=Math.max(0,Math.min(s.length-1,i+d));show()}
addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key))go(1);else if(['ArrowLeft','PageUp'].includes(e.key))go(-1);else if(e.key==='Home'){i=0;show()}else if(e.key==='End'){i=s.length-1;show()}else if(e.key==='n'||e.key==='N')notes.style.display=notes.style.display==='block'?'none':'block';else if(e.key==='f'||e.key==='F')document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()});
addEventListener('click',e=>{if(!e.target.closest('#notes'))go(e.clientX<innerWidth/4?-1:1)});
addEventListener('hashchange',()=>{const n=+location.hash.slice(1);if(n>=1&&n<=s.length&&n-1!==i){i=n-1;show()}});addEventListener('resize',fit);fit();show();
</script>
</body></html>
`);
console.log(`${slides.length} slides -> ${out}`);
