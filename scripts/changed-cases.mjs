// Parmi les cas dont l'énoncé a changé entre deux versions des plans, lesquels
// sont déjà joués ?
//
//   TCMS_PASSWORD=… node scripts/changed-cases.mjs \
//     --before=/chemin/pivot-avant.json --url=https://… --email=…
//
// À lancer AVANT un import qui réécrit des énoncés. L'import sait signaler les
// cas joués qu'il modifie, mais il le dit en écrivant : quand sa liste s'affiche,
// les énoncés sont déjà remplacés. Ici, rien n'est touché — on décide d'abord.
//
// Le pivot « avant » se régénère depuis l'historique de focus-qa :
//
//   git -C ../focus-qa worktree add --detach /tmp/qa-avant <sha>
//   (cd /tmp/qa-avant && node scripts/export-cases.mjs && cp out/cases.json /tmp/pivot-avant.json)
//   git -C ../focus-qa worktree remove --force /tmp/qa-avant
//
// Lecture seule.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { refuseReporter } from './lib/membership.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = (arg('url') ?? '').replace(/\/+$/, '');
const API_PATH = arg('api-path', '/api').replace(/\/+$/, '');
const EMAIL = arg('email');
const PASSWORD = process.env.TCMS_PASSWORD;
const PROJECT_NAME = arg('project');
const AFTER = resolve(arg('cases', new URL('../../focus-qa/out/cases.json', import.meta.url).pathname));
const BEFORE = arg('before');

if (!BASE || !EMAIL || !PASSWORD || !BEFORE) {
  console.error(
    'Usage : TCMS_PASSWORD=… node scripts/changed-cases.mjs --before=… --url=https://… --email=…\n' +
      '  --before=<chemin>  le pivot AVANT modification (obligatoire)\n' +
      '  --cases=<chemin>   le pivot après (défaut : ../focus-qa/out/cases.json)\n' +
      '  --project=<nom>    le projet à lire\n' +
      "  --api-path=<p>     préfixe de l'API (défaut : /api ; vide en développement)"
  );
  process.exit(1);
}

let token = null;

const api = async (method, path, { query, body } = {}) => {
  const url = new URL(`${BASE}${API_PATH}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
};

const rows = (payload) => (Array.isArray(payload) ? payload : (payload?.data ?? []));

/** La référence en tête du titre — `CTL-01 — …` donne `CTL-01`. Même règle que l'import. */
const refFromTitle = (title) => (title ?? '').split(' — ')[0].trim();

/** `(plan, référence)` : insensible aux titres de plan et à l'arborescence. */
const keyOf = (c) => `${c.plan}/${c.ref}`;

/** L'index EST la valeur stockée — `frontend/config/selection.ts`. */
const STATUS_LABELS = ['non testé', 'réussi', 'échoué', 'à rejouer', 'ignoré'];
const labelOf = (status) => STATUS_LABELS[status] ?? `statut ${status}`;

const before = JSON.parse(readFileSync(resolve(BEFORE), 'utf-8'));
const after = JSON.parse(readFileSync(AFTER, 'utf-8'));

/**
 * Ce qui a changé, et de quelle nature.
 *
 * La distinction porte tout l'arbitrage : un énoncé réécrit pose une AUTRE
 * question, et l'avis déjà donné répondait à l'ancienne. Une précondition qui
 * bouge ne change que le contexte — et comme elle s'hérite de la section, elle
 * touche tous ses cas d'un coup. Les mélanger noierait les quelques vrais dans
 * des dizaines de faux.
 */
const previous = new Map(before.cases.map((c) => [keyOf(c), c]));
const changed = [];
for (const c of after.cases) {
  const was = previous.get(keyOf(c));
  if (!was) continue; // cas neuf : personne n'a pu le jouer
  const fields = [];
  if ((was.statement ?? '') !== (c.statement ?? '')) fields.push('énoncé');
  if ((was.preConditions ?? '') !== (c.preConditions ?? '')) fields.push('préconditions');
  if ((was.expectedResults ?? '') !== (c.expectedResults ?? '')) fields.push('attendu');
  if (fields.length > 0) changed.push({ key: keyOf(c), ref: c.ref, plan: c.plan, title: c.title, fields });
}

console.log(`\n${before.cases.length} cas avant · ${after.cases.length} après · ${changed.length} modifiés\n`);

if (changed.length === 0) {
  console.log('Rien n’a changé sur les cas existants : l’import n’écrasera aucun énoncé.\n');
  process.exit(0);
}

const restated = changed.filter((c) => c.fields.includes('énoncé'));
console.log(`  ${restated.length} énoncés réécrits — ils posent une autre question`);
console.log(`  ${changed.length - restated.length} dont seuls le contexte ou l’attendu bougent\n`);

try {
  const session = await api('POST', '/users/signin', { body: { email: EMAIL, password: PASSWORD } });
  token = session.access_token ?? session.token ?? session.accessToken;
} catch {
  console.error(`Connexion refusée sur ${BASE} : vérifier l'adresse et le mot de passe.`);
  process.exit(1);
}

const projects = rows(await api('GET', '/projects'));
const project = PROJECT_NAME
  ? projects.find((p) => p.name === PROJECT_NAME)
  : (projects.findLast?.((p) => /focus/i.test(p.name)) ?? projects[projects.length - 1]);
if (!project) {
  console.error('Projets disponibles :', projects.map((p) => p.name).join(' | '));
  process.exit(1);
}

await refuseReporter({
  api,
  project,
  email: EMAIL,
  why: 'Un cas modifié et joué par quelqu’un d’autre serait donc absent, et le\nscript conclurait qu’il n’y a rien à remettre à faire.',
});

const folders = rows(await api('GET', '/folders', { query: { projectId: project.id } }));
const folderById = new Map(folders.map((f) => [f.id, f]));
const planOf = (folderId) => {
  const parts = [];
  let current = folderById.get(folderId);
  while (current) {
    parts.unshift(current.name);
    current = current.parentFolderId ? folderById.get(current.parentFolderId) : null;
  }
  return (parts[0] ?? '').split(' — ')[0].trim();
};

// Toutes les campagnes du PROJET, pas celles que le pivot décrit : une campagne
// archivée ou créée à la main porte des statuts qui comptent autant.
const runs = rows(await api('GET', '/runs', { query: { projectId: project.id } }));
const wanted = new Map(changed.map((c) => [c.key, c]));
const played = new Map();

for (const run of runs) {
  const cases = rows(await api('GET', '/cases/byproject', { query: { projectId: project.id, runId: run.id } }));
  for (const testCase of cases) {
    const key = `${planOf(testCase.folderId)}/${refFromTitle(testCase.title)}`;
    if (!wanted.has(key)) continue;
    for (const runCase of testCase.RunCases ?? []) {
      if (Number(runCase.runId) !== Number(run.id) || runCase.status === 0) continue;
      const entry = played.get(key) ?? { ...wanted.get(key), seen: [] };
      entry.seen.push({
        run: run.name,
        status: runCase.status,
        comments: runCase.commentCount ?? 0,
        verdicts: (runCase.Verdicts ?? []).map((v) => `${v.username || 'auteur inconnu'} — ${labelOf(v.status)}`),
      });
      played.set(key, entry);
    }
  }
}

const playedRestated = [...played.values()].filter((c) => c.fields.includes('énoncé'));
const playedContext = [...played.values()].filter((c) => !c.fields.includes('énoncé'));

if (played.size === 0) {
  console.log('Aucun cas modifié n’est joué : l’import est sans conséquence sur les avis.\n');
  process.exit(0);
}

if (playedRestated.length > 0) {
  console.log(`${playedRestated.length} ÉNONCÉS RÉÉCRITS SONT DÉJÀ JOUÉS — candidats à la remise à faire :\n`);
  for (const c of playedRestated) {
    console.log(`  ${c.key}  ${String(c.title).slice(0, 78)}`);
    for (const s of c.seen) {
      console.log(`      ${s.run} — ${labelOf(s.status)}${s.comments ? `, ${s.comments} commentaire(s)` : ''}`);
      for (const v of s.verdicts) console.log(`         avis : ${v}`);
    }
  }
  console.log();
}

if (playedContext.length > 0) {
  console.log(`${playedContext.length} joués dont seul le contexte bouge — la question reste la même :\n`);
  for (const c of playedContext) {
    console.log(`  ${c.key}  (${c.fields.join(', ')})`);
  }
  console.log();
}

console.log('Rien n’a été modifié. La remise à faire se décide dans l’interface, cas par cas.\n');
