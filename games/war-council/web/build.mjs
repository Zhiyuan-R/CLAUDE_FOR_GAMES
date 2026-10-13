// Builds the web edition: one self-contained page (web/dist/war-council.html)
// that runs the battle in the browser with Claude as both armies' brain.
// Each ES module is wrapped in its own function scope and its imports are
// rewired to the wrapped modules' exports, so no bundler is needed.
//   node web/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// Dependency order: each module may only import from modules above it.
const MODULES = ['src/engine.js', 'src/tactics.js', 'web/claude-council.js', 'web/local-transport.js', 'public/app.js'];
const varName = (file) => '__' + path.basename(file, '.js').replace(/[^a-zA-Z0-9]/g, '_');

function wrap(file) {
  let src = read(file);
  const exportsList = [];
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?$/gm, (_, names, from) => {
    const target = MODULES.find((m) => path.resolve(root, path.dirname(file), from) === path.resolve(root, m));
    if (!target) throw new Error(`${file}: cannot resolve import from ${from}`);
    const binds = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': '));
    return `const { ${binds.join(', ')} } = ${varName(target)};`;
  });
  if (/^import\s/m.test(src)) throw new Error(`${file}: unsupported import form`);
  src = src.replace(/^export\s+(async\s+function|function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exportsList.push(name);
    return `${kind} ${name}`;
  });
  if (/^export\s/m.test(src)) throw new Error(`${file}: unsupported export form`);
  return `// ---- ${file} ----\nconst ${varName(file)} = (() => {\n${src}\nreturn { ${exportsList.join(', ')} };\n})();\n`;
}

const shell = read('web/shell.html');
const style = read('public/style.css');
const index = read('public/index.html');
const body = index.slice(index.indexOf('<body>') + 6, index.indexOf('<script')).trim()
  .replace('<form id="order">', '<form id="order">\n          <p id="note" hidden></p>');
const script = MODULES.map(wrap).join('\n');

const out = shell
  .replace('/*{{STYLE}}*/', () => style)
  .replace('<!--{{BODY}}-->', () => body)
  .replace('//{{SCRIPT}}', () => script);

fs.mkdirSync(path.join(root, 'web/dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'web/dist/war-council.html'), out);
console.log(`web/dist/war-council.html written (${(out.length / 1024).toFixed(1)} KB)`);
