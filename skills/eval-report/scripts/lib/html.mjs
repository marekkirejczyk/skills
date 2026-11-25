// A tagged template that escapes every interpolated value unless it is
// already markup, so report code never builds HTML by string concatenation.

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export class Markup {
  constructor(text) {
    this.text = text;
  }

  toString() {
    return this.text;
  }
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ENTITIES[character]);
}

export function trusted(text) {
  return new Markup(String(text));
}

function toMarkup(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof Markup) return value.text;
  if (Array.isArray(value)) return value.map(toMarkup).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let text = strings[0];
  values.forEach((value, index) => {
    text += toMarkup(value) + strings[index + 1];
  });
  return new Markup(text);
}
