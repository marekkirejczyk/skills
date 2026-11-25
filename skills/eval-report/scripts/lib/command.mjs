// The shell command that runs the evals, from the template in .eval-report.json.

const shellQuote = (text) => `'${text.replace(/'/g, `'\\''`)}'`;

// {files} becomes the eval files to run (only with --only, otherwise nothing);
// with --only and no placeholder, the files are appended.
export function commandFor(template, files, only) {
  const list = files.map(shellQuote).join(' ');
  if (template.includes('{files}')) return template.replaceAll('{files}', only ? list : '').replace(/\s+/g, ' ').trim();
  return only ? `${template} ${list}` : template;
}
