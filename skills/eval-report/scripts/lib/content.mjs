// Turns a run's input, output and tool results into readable markup:
// light markdown for text, cards and lists for rich output, key/value lists for JSON.

import { escapeHtml, html, trusted } from './html.mjs';

const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/;

function inline(text) {
  return trusted(
    escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'),
  );
}

// Paragraphs, bullet and numbered lists, code fences, **bold** and `code`.
export function renderMarkdown(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      index++;
    } else if (line.trimStart().startsWith('```')) {
      const code = [];
      index++;
      while (index < lines.length && !lines[index].trimStart().startsWith('```')) code.push(lines[index++]);
      index++;
      blocks.push(html`<pre class="code">${code.join('\n')}</pre>`);
    } else if (LIST_ITEM.test(line)) {
      const items = [];
      const ordered = /^\s*\d+\./.test(line);
      while (index < lines.length && LIST_ITEM.test(lines[index])) items.push(lines[index++].replace(LIST_ITEM, ''));
      const listItems = items.map((item) => html`<li>${inline(item)}</li>`);
      blocks.push(ordered ? html`<ol>${listItems}</ol>` : html`<ul>${listItems}</ul>`);
    } else {
      const paragraph = [];
      while (index < lines.length && lines[index].trim() !== '' && !LIST_ITEM.test(lines[index]) && !lines[index].trimStart().startsWith('```')) {
        paragraph.push(lines[index++]);
      }
      blocks.push(html`<p>${inline(paragraph.join(' '))}</p>`);
    }
  }
  return html`${blocks}`;
}

export function summarizeValue(value, maxLength = 60) {
  if (value === undefined) return '—';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

const isPlain = (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value);

export function renderValue(value) {
  if (value === undefined) return html`<span class="muted">(none)</span>`;
  if (typeof value === 'string') return renderMarkdown(value);
  if (isPlain(value)) return html`<code>${String(value)}</code>`;
  if (Array.isArray(value)) {
    return html`<ul>${value.map((item) => html`<li>${isPlain(item) ? String(item) : html`<code>${JSON.stringify(item)}</code>`}</li>`)}</ul>`;
  }
  const entries = Object.entries(value).map(
    ([key, item]) => html`<dt>${key}</dt><dd>${isPlain(item) ? String(item) : html`<code>${JSON.stringify(item)}</code>`}</dd>`,
  );
  return html`<dl class="pairs">${entries}</dl>`;
}

const isMessage = (item) => item && typeof item === 'object' && 'role' in item && ('text' in item || 'content' in item || 'blocks' in item);

const NO_WORDS = html`<p class="muted no-words">(no words)</p>`;

const renderWords = (text) => (String(text ?? '').trim() === '' ? NO_WORDS : renderMarkdown(text));

// A message of a conversation: its words, then the blocks it came with, as a reply's.
function renderMessage(message) {
  const said = message.text ?? message.content;
  const words = said === undefined || said === null || typeof said === 'string' ? renderWords(said) : renderValue(said);
  return html`<div class="message"><div class="who">${message.role}</div>${words}${(message.blocks ?? []).map(renderBlock)}</div>`;
}

export function renderInput(input) {
  if (Array.isArray(input) && input.length > 0 && input.every(isMessage)) return html`${input.map(renderMessage)}`;
  return renderValue(input);
}

function renderBlock(block) {
  switch (block?.type) {
    case 'card':
      return html`<div class="card">
        ${block.title ? html`<div class="card-title">${block.title}</div>` : ''}
        ${block.body ? renderMarkdown(block.body) : ''}
        ${block.options?.length ? html`<div class="chips">${block.options.map((option) => html`<span class="chip">${option}</span>`)}</div>` : ''}
      </div>`;
    case 'list':
      return html`<div class="card">
        ${block.title ? html`<div class="card-title">${block.title}</div>` : ''}
        <ul>${(block.items ?? []).map((item) =>
          typeof item === 'object' && item !== null ? html`<li><strong>${item.label}</strong> ${item.value}</li>` : html`<li>${inline(String(item))}</li>`,
        )}</ul>
      </div>`;
    case 'table':
      return html`<div class="card table-card">
        ${block.title ? html`<div class="card-title">${block.title}</div>` : ''}
        <table class="mini"><thead><tr>${(block.columns ?? []).map((column) => html`<th>${column}</th>`)}</tr></thead>
        <tbody>${(block.rows ?? []).map((row) => html`<tr>${row.map((cell) => html`<td>${String(cell)}</td>`)}</tr>`)}</tbody></table>
      </div>`;
    default:
      return html`<div class="card">${renderValue(block)}</div>`;
  }
}

export function renderOutput(output, error) {
  const crash = error ? html`<div class="crash"><strong>Error</strong> ${error}</div>` : '';
  if (output === undefined || output === null) return error ? crash : NO_WORDS;
  if (typeof output === 'string') return html`${crash}${renderWords(output)}`;
  const isReply = typeof output === 'object' && !Array.isArray(output) && ('text' in output || 'blocks' in output);
  if (!isReply) return html`${crash}${renderValue(output)}`;
  return html`${crash}${renderWords(output.text)}${(output.blocks ?? []).map(renderBlock)}`;
}
