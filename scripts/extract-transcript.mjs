import fs from 'fs';
import path from 'path';

const transcriptPath =
  'C:/Users/Usuario/.cursor/projects/c-Users-Usuario-Desktop-Proyecto-Sistema-LB-1-GooFlow/agent-transcripts/21431beb-1af7-421d-baad-c71052f22116/21431beb-1af7-421d-baad-c71052f22116.jsonl';
const outDir = 'C:/Users/Usuario/Desktop/Proyecto Sistema LB/1.- GooFlow/.extracted-from-transcript';
fs.mkdirSync(outDir, { recursive: true });

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);

function normPath(p) {
  return (p || '').replace(/\\/g, '/');
}

function matches(p, name) {
  return normPath(p).toLowerCase().includes(name.toLowerCase());
}

const writes = {};
const strReplaces = [];
const applyPatches = [];

for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  let obj;
  try {
    obj = JSON.parse(lines[i]);
  } catch {
    continue;
  }
  const content = obj?.message?.content;
  if (!Array.isArray(content)) continue;

  for (const block of content) {
    if (block.type !== 'tool_use') continue;
    const { name, input } = block;

    if (name === 'Write' && input?.path && input?.contents !== undefined) {
      const p = normPath(input.path);
      const key = p.split('/').slice(-2).join('_');
      writes[key] = writes[key] || [];
      writes[key].push({ line: lineNum, path: p, contents: input.contents });
    }

    if (name === 'StrReplace' && input?.path) {
      strReplaces.push({
        line: lineNum,
        path: normPath(input.path),
        old_string: input.old_string,
        new_string: input.new_string,
      });
    }

    if (name === 'ApplyPatch' && typeof input === 'string') {
      applyPatches.push({ line: lineNum, patch: input });
    }
  }
}

console.log('=== ALL WRITES ===');
for (const [k, arr] of Object.entries(writes).sort()) {
  console.log(
    k,
    arr.map((x) => `L${x.line}(${x.contents.length}ch)`).join(', ')
  );
}

// ProductWorkspace: last write >=690 + subsequent strReplaces
const wsWrites = Object.entries(writes)
  .flatMap(([, arr]) => arr)
  .filter((w) => matches(w.path, 'ProductWorkspace.tsx'))
  .sort((a, b) => a.line - b.line);

if (wsWrites.length) {
  const base = wsWrites.filter((w) => w.line >= 690).pop() || wsWrites[wsWrites.length - 1];
  let content = base.contents;
  const patches = strReplaces
    .filter((s) => matches(s.path, 'ProductWorkspace.tsx') && s.line > base.line)
    .sort((a, b) => a.line - b.line);

  for (const p of patches) {
    if (content.includes(p.old_string)) {
      content = content.replace(p.old_string, p.new_string);
      console.log(`WS: applied L${p.line}`);
    } else {
      console.log(`WS: SKIP L${p.line} (old not found, len=${p.old_string?.length})`);
    }
  }
  fs.writeFileSync(path.join(outDir, 'ProductWorkspace.tsx'), content);
  console.log(`ProductWorkspace: ${content.split('\n').length} lines, ${content.length} chars`);
}

// productCatalogConstants
const catWrites = Object.entries(writes)
  .flatMap(([, arr]) => arr)
  .filter((w) => matches(w.path, 'productCatalogConstants.ts'))
  .sort((a, b) => a.line - b.line);
if (catWrites.length) {
  let content = catWrites[catWrites.length - 1].contents;
  for (const p of strReplaces.filter((s) => matches(s.path, 'productCatalogConstants.ts'))) {
    if (content.includes(p.old_string)) content = content.replace(p.old_string, p.new_string);
  }
  fs.writeFileSync(path.join(outDir, 'productCatalogConstants.ts'), content);
  console.log(`productCatalogConstants: ${content.length} chars`);
}

// ProductModule writes
const pmWrites = Object.entries(writes)
  .flatMap(([, arr]) => arr)
  .filter((w) => matches(w.path, 'ProductModule.tsx'))
  .sort((a, b) => a.line - b.line);
for (const w of pmWrites) {
  fs.writeFileSync(
    path.join(outDir, `ProductModule-L${w.line}.tsx`),
    w.contents
  );
}
if (pmWrites.length) {
  const last = pmWrites[pmWrites.length - 1];
  let content = last.contents;
  for (const p of strReplaces.filter((s) => matches(s.path, 'ProductModule.tsx') && s.line > last.line)) {
    if (content.includes(p.old_string)) content = content.replace(p.old_string, p.new_string);
  }
  fs.writeFileSync(path.join(outDir, 'ProductModule.tsx'), content);
  console.log(`ProductModule last L${last.line}: ${content.length} chars`);
}

// productDraftUtils
const draftWrites = Object.entries(writes)
  .flatMap(([, arr]) => arr)
  .filter((w) => matches(w.path, 'productDraftUtils.ts'));
if (draftWrites.length) {
  fs.writeFileSync(
    path.join(outDir, 'productDraftUtils.ts'),
    draftWrites[draftWrites.length - 1].contents
  );
}

// productCode
const codeWrites = Object.entries(writes)
  .flatMap(([, arr]) => arr)
  .filter((w) => matches(w.path, 'productCode.ts'));
console.log('productCode writes:', codeWrites.length);

// types StrReplace for Product
const typePatches = strReplaces.filter((s) => matches(s.path, 'types/index.ts') && s.old_string?.includes('export interface Product'));
for (const p of typePatches) {
  fs.writeFileSync(path.join(outDir, `types-product-L${p.line}-new.ts`), p.new_string);
  fs.writeFileSync(path.join(outDir, `types-product-L${p.line}-old.ts`), p.old_string);
}
console.log('types patches:', typePatches.map((p) => 'L' + p.line).join(', '));

// App.tsx patches with currentUser ProductModule
const appPatches = applyPatches.filter((p) => p.patch.includes('ProductModule') || p.patch.includes('currentUser'));
for (const p of appPatches) {
  fs.writeFileSync(path.join(outDir, `App-patch-L${p.line}.txt`), p.patch);
}
console.log('App patches:', appPatches.map((p) => 'L' + p.line).join(', '));

// ProductModule ApplyPatch (line 17 initial)
const pmPatches = applyPatches.filter((p) => p.patch.includes('ProductModule.tsx'));
for (const p of pmPatches) {
  fs.writeFileSync(path.join(outDir, `ProductModule-patch-L${p.line}.txt`), p.patch);
}
console.log('ProductModule ApplyPatches:', pmPatches.map((p) => 'L' + p.line).join(', '));
