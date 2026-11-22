const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const patch = JSON.parse(fs.readFileSync(path.join(root, 'ui/v320.patch.json'), 'utf8'));
const replace = (html, edits) => {
  for (const [from, to] of edits) {
    if (!html.includes(from)) throw new Error('Missing v320 source: ' + from.slice(0, 100));
    html = html.replace(from, () => to);
  }
  return html;
};
let html = fs.readFileSync(path.join(root, 'Hospitalito_v319.html'), 'utf8');
html = replace(html, patch.edits);
html = html.replaceAll('v319', 'v320').replace('id="hc-v320-settings"', 'id="hc-v319-settings"');
html = replace(html, [['\n</body>\n</html>\n', patch.extras + '\n</body>\n</html>\n']]);
html = replace(html, patch.revisions);
for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!attrs.includes('src=')) new vm.Script(body, { filename: attrs.trim() || 'Hospitalito v320' });
}
for (const filename of ['index.html', 'Hospitalito_v320.html']) {
  fs.writeFileSync(path.join(root, filename), html);
}
