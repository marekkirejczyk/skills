import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderInput, renderMarkdown, renderOutput, renderValue, summarizeValue } from '../../skills/eval-report/scripts/lib/content.mjs';
import { html } from '../../skills/eval-report/scripts/lib/html.mjs';

const text = (markup) => String(markup).replace(/\s+/g, ' ').trim();

describe('html', () => {
  it('escapes interpolated text', () => {
    assert.equal(String(html`<p>${'<b>"x" & \'y\'</b>'}</p>`), '<p>&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;</p>');
  });

  it('keeps nested markup and drops empty values', () => {
    assert.equal(String(html`<p>${html`<b>x</b>`}${null}${false}${[html`<i>a</i>`, 'b']}</p>`), '<p><b>x</b><i>a</i>b</p>');
  });
});

describe('renderMarkdown', () => {
  it('splits paragraphs on blank lines', () => {
    assert.equal(text(renderMarkdown('one\ntwo\n\nthree')), '<p>one two</p><p>three</p>');
  });

  it('renders bullet and numbered lists', () => {
    assert.equal(text(renderMarkdown('- a\n- b')), '<ul><li>a</li><li>b</li></ul>');
    assert.equal(text(renderMarkdown('1. a\n2. b')), '<ol><li>a</li><li>b</li></ol>');
  });

  it('renders bold and code', () => {
    assert.equal(text(renderMarkdown('**big** and `x`')), '<p><strong>big</strong> and <code>x</code></p>');
  });

  it('renders a code fence as preformatted text', () => {
    assert.equal(String(renderMarkdown('```\nconst a = 1;\n```')), '<pre class="code">const a = 1;</pre>');
  });

  it('escapes HTML in the text', () => {
    assert.equal(text(renderMarkdown('<script>x</script>')), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
  });
});

describe('renderInput', () => {
  it('shows a conversation by speaker', () => {
    const markup = text(renderInput([{ role: 'buyer', text: 'Hi' }, { role: 'assistant', content: 'Hello' }]));
    assert.match(markup, /<div class="who">buyer<\/div><p>Hi<\/p>.*<div class="who">assistant<\/div><p>Hello<\/p>/);
  });

  it('shows the blocks a message came with under its words', () => {
    const question = { type: 'card', title: 'Question', body: 'Which?', options: ['A', 'B'] };
    const markup = text(renderInput([{ role: 'buyer', text: 'Hi' }, { role: 'assistant', text: 'Pick one', blocks: [question] }]));
    assert.match(markup, /<div class="who">assistant<\/div><p>Pick one<\/p>\s*<div class="card">.*<div class="card-title">Question<\/div>.*<span class="chip">A<\/span><span class="chip">B<\/span>/);
  });

  it('says "no words" for a message of blocks alone, or of nothing', () => {
    const cardOnly = text(renderInput([{ role: 'assistant', text: '', blocks: [{ type: 'card', title: 'Question' }] }]));
    assert.match(cardOnly, /<div class="who">assistant<\/div><p class="muted no-words">\(no words\)<\/p>\s*<div class="card">.*Question/);
    assert.match(text(renderInput([{ role: 'assistant', blocks: [{ type: 'card', title: 'Question' }] }])), /\(no words\).*Question/);
    assert.equal(text(renderInput([{ role: 'assistant', text: ' ' }])), '<div class="message"><div class="who">assistant</div><p class="muted no-words">(no words)</p></div>');
  });

  it('shows a message that is JSON as key and value pairs', () => {
    assert.match(text(renderInput([{ role: 'tool', content: { shown: 3 } }])), /<div class="who">tool<\/div><dl class="pairs"><dt>shown<\/dt><dd>3<\/dd><\/dl>/);
  });

  it('shows an object as key and value pairs', () => {
    assert.equal(text(renderInput({ make: 'Skoda', year: 2020 })), '<dl class="pairs"><dt>make</dt><dd>Skoda</dd><dt>year</dt><dd>2020</dd></dl>');
  });

  it('says when there is no input', () => {
    assert.match(String(renderInput(undefined)), /\(none\)/);
  });
});

describe('renderOutput', () => {
  it('says "no words" for an empty reply', () => {
    assert.match(String(renderOutput('')), /\(no words\)/);
    assert.match(String(renderOutput({ text: '', blocks: [{ type: 'card', title: 'Card' }] })), /\(no words\).*Card/s);
  });

  it('renders a card with its options', () => {
    const markup = text(renderOutput({ text: 'Pick', blocks: [{ type: 'card', title: 'Question', body: 'Which?', options: ['A', 'B'] }] }));
    assert.match(markup, /<div class="card-title">Question<\/div>.*<p>Which\?<\/p>.*<span class="chip">A<\/span><span class="chip">B<\/span>/);
  });

  it('renders a list of labelled values', () => {
    assert.match(text(renderOutput({ text: 'x', blocks: [{ type: 'list', items: [{ label: 'APR', value: '9.9%' }] }] })), /<li><strong>APR<\/strong> 9.9%<\/li>/);
  });

  it('renders a table', () => {
    const markup = text(renderOutput({ text: 'x', blocks: [{ type: 'table', columns: ['a', 'b'], rows: [[1, 2]] }] }));
    assert.match(markup, /<th>a<\/th><th>b<\/th>.*<td>1<\/td><td>2<\/td>/);
  });

  it('shows an error before the output', () => {
    assert.match(text(renderOutput('partial', 'timed out')), /class="crash".*timed out.*<p>partial<\/p>/);
  });

  it('shows the error alone when there is no output', () => {
    assert.doesNotMatch(String(renderOutput(undefined, 'boom')), /no words/);
  });

  it('shows other JSON as key and value pairs', () => {
    assert.match(text(renderOutput({ score: 3 })), /<dt>score<\/dt><dd>3<\/dd>/);
  });
});

describe('renderValue', () => {
  it('shows nested values as compact JSON', () => {
    assert.match(text(renderValue({ a: { b: 1 } })), /<code>\{&quot;b&quot;:1\}<\/code>/);
  });
});

describe('summarizeValue', () => {
  it('keeps short values whole', () => {
    assert.equal(summarizeValue({ a: 1 }), '{"a":1}');
  });

  it('cuts long values with an ellipsis', () => {
    assert.equal(summarizeValue('x'.repeat(100), 10), 'xxxxxxxxx…');
  });

  it('shows a dash for nothing', () => {
    assert.equal(summarizeValue(undefined), '—');
  });
});
