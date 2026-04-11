/**
 * Lee docs/VERCEL_APP_URL.txt y aplica ALLOWED_ORIGINS en Supabase Edge Functions.
 * Uso: npm run supabase:secrets:allowed-origins
 *
 * Acepta http:// (localhost) y https:// (Vercel / produccion).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const urlFile = join(root, 'docs', 'VERCEL_APP_URL.txt');
const projectRefFile = join(root, 'supabase', '.temp', 'project-ref');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function normalizeOrigin(o) {
  let s = o.trim();
  if (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

if (!existsSync(urlFile)) {
  fail('No existe docs/VERCEL_APP_URL.txt');
}

const raw = readFileSync(urlFile, 'utf8');
const lines = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const origins = [];
for (const l of lines) {
  for (const part of l.split(',')) {
    const p = part.trim();
    if (/^https?:\/\//i.test(p)) {
      origins.push(normalizeOrigin(p));
    }
  }
}

if (origins.length === 0) {
  fail(
    'docs/VERCEL_APP_URL.txt: añade al menos un origen, ej. http://localhost:5173 o https://tu-app.vercel.app'
  );
}

const bad = origins.some(
  (o) =>
    o.includes('CAMBIA-AQUI') ||
    o.includes('PENDIENTE') ||
    o.toLowerCase().includes('ejemplo') ||
    o.includes('REPLACE')
);
if (bad) {
  fail(
    'Quita el texto de ejemplo y pon tu URL real (localhost y/o Vercel) en docs/VERCEL_APP_URL.txt'
  );
}

const line = origins.join(',');

let projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
if (!projectRef && existsSync(projectRefFile)) {
  projectRef = readFileSync(projectRefFile, 'utf8').trim();
}
if (!projectRef) {
  fail('No hay project ref. Ejecuta: npx supabase link --project-ref TU_REF');
}

const pair = `ALLOWED_ORIGINS=${line}`;
console.log('Aplicando secret ALLOWED_ORIGINS en proyecto', projectRef);
console.log('Valor (origenes):', line);

const r = spawnSync(
  'npx',
  ['supabase', 'secrets', 'set', pair, '--project-ref', projectRef],
  { cwd: root, stdio: 'inherit', shell: true }
);

if (r.status !== 0) {
  process.exit(r.status ?? 1);
}
console.log('Listo. Vuelve a desplegar la funcion server: npm run supabase:deploy:server');
