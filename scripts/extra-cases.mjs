// Trouve les cas qu'une instance porte en trop : ceux que les plans ne
// définissent plus, et ceux qu'ils définissent une seule fois mais que
// l'instance porte en plusieurs exemplaires.
//
//   TCMS_PASSWORD=… node scripts/extra-cases.mjs --url=https://… --email=…
//   TCMS_PASSWORD=… node scripts/extra-cases.mjs --url=https://… --email=… --delete
//
// Sans `--delete` il ne fait que lister : c'est le mode normal, et le seul à
// lancer sans avoir regardé.
//
// Même origine pour les deux : l'import rapprochait les cas sur leur TITRE
// jusqu'à la PR #2. Renommer un titre créait un cas neuf et laissait l'ancien
// derrière — orphelin si sa référence a disparu des plans, sosie si elle y est
// restée. Le rapprochement se fait sur la référence depuis, mais ce qui a déjà
// été créé ne disparaît pas tout seul.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { refuseReporter } from './lib/membership.mjs';
import { countHumanTags, hasHumanWork, workLabel } from './lib/humanWork.mjs';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const BASE = (arg('url') ?? '').replace(/\/+$/, '');
const API_PATH = arg('api-path', '/api').replace(/\/+$/, '');
const EMAIL = arg('email');
const PASSWORD = process.env.TCMS_PASSWORD;
const PROJECT_NAME = arg('project');
const CASES = resolve(arg('cases', new URL('../../focus-qa/out/cases.json', import.meta.url).pathname));
const DELETE = flag('delete');

/**
 * Au-delà, on ne supprime pas : un tel nombre dit que le pivot ne correspond
 * pas à l'instance — mauvais projet, ou export d'une autre époque — et non que
 * l'instance est pleine de déchets.
 */
const MAX_SUPPRIMABLES = 20;

if (!BASE || !EMAIL || !PASSWORD) {
  console.error(
    'Usage : TCMS_PASSWORD=… node scripts/extra-cases.mjs --url=https://… --email=…\n' +
      '  --delete          supprime les orphelins sans avis (par défaut : liste seulement)\n' +
      '  --cases=<chemin>  le pivot de référence (défaut : ../focus-qa/out/cases.json)\n' +
      '  --project=<nom>   le projet à lire\n' +
      "  --api-path=<p>    préfixe de l'API (défaut : /api ; vide en développement)"
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

const payload = JSON.parse(readFileSync(CASES, 'utf-8'));

try {
  const session = await api('POST', '/users/signin', { body: { email: EMAIL, password: PASSWORD } });
  token = session.access_token ?? session.token ?? session.accessToken;
} catch {
  console.error(`\nConnexion refusée sur ${BASE} : vérifier l'adresse et le mot de passe.`);
  process.exit(1);
}
if (!token) {
  console.error('\nConnexion acceptée mais aucun jeton renvoyé.');
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
  why: 'Les statuts et les avis lui seraient donc invisibles, et un cas que\nquelqu’un a joué passerait pour un déchet supprimable.',
});

// Les dossiers de l'instance, pour retrouver où chaque cas est rangé.
const folders = rows(await api('GET', '/folders', { query: { projectId: project.id } }));
const folderById = new Map(folders.map((f) => [f.id, f]));
const pathOf = (folderId) => {
  const parts = [];
  let current = folderById.get(folderId);
  while (current) {
    parts.unshift(current.name);
    current = current.parentFolderId ? folderById.get(current.parentFolderId) : null;
  }
  return parts.join(' / ');
};

/**
 * Le code en tête d'un nom de dossier — `00 — Le fil` donne `00`.
 *
 * Le rapprochement porte sur les CODES, jamais sur les titres : renommer un
 * plan ferait passer tous ses cas pour des orphelins, et c'est le genre de
 * méprise qui finit en suppression de masse.
 */
/**
 * Le plan dont relève un cas — le code en tête du dossier le plus haut.
 *
 * Ni le titre du plan, ni le sous-dossier de section n'entrent dans le
 * rapprochement : un plan renommé, ou une arborescence qui a changé de forme
 * entre deux générations du projet, ferait passer tous ses cas pour des
 * orphelins — le genre de méprise qui finit en suppression de masse.
 *
 * `(plan, référence)` suffit : chaque section a son préfixe, donc deux sections
 * d'un même plan ne partagent jamais une référence.
 */
const planOf = (folderId) => {
  const root = pathOf(folderId).split(' / ')[0] ?? '';
  return root.split(' — ')[0].trim();
};

// Ce que les plans définissent, exprimé comme l'import le rangerait.
const defined = new Set();
for (const c of payload.cases) {
  defined.add(`${c.plan}||${c.ref}`);
}

// L'inventaire se fait par DOSSIER, pas par campagne.
//
// Un cas peut n'être rattaché à aucune campagne — et c'est précisément le genre
// de reste qu'on cherche. Énumérer par campagne ne l'aurait jamais vu, et sur un
// projet sans campagne du tout le script aurait annoncé « rien en trop » sur un
// inventaire vide.
const seen = new Map();
for (const folder of folders) {
  const cases = rows(await api('GET', '/cases', { query: { folderId: folder.id } }));
  for (const testCase of cases) {
    seen.set(testCase.id, {
      testCase,
      played: false,
      verdicts: 0,
      comments: 0,
      attachments: 0,
      humanTags: countHumanTags(testCase.Tags),
      runNames: [],
    });
  }
}

// Puis ce que les campagnes en disent : statut, avis, commentaires.
const runs = rows(await api('GET', '/runs', { query: { projectId: project.id } }));
for (const run of runs) {
  const cases = rows(await api('GET', '/cases/byproject', { query: { projectId: project.id, runId: run.id } }));
  for (const testCase of cases) {
    const entry = seen.get(testCase.id);
    if (!entry) continue;
    for (const runCase of testCase.RunCases ?? []) {
      if (Number(runCase.runId) !== Number(run.id)) continue;
      entry.runNames.push(run.name);
      if (runCase.status !== 0) entry.played = true;
      entry.verdicts += (runCase.Verdicts ?? []).length;
      entry.comments += runCase.commentCount ?? 0;
    }
  }
}

const keyOf = ({ testCase }) => `${planOf(testCase.folderId)}||${refFromTitle(testCase.title)}`;
const entries = [...seen.values()];
const orphans = entries.filter((e) => !defined.has(keyOf(e)));

// Les cas que les plans définissent DEUX FOIS.
//
// Même origine que les orphelins, et symétrique : l'ancien rapprochement sur le
// titre créait un cas neuf à chaque renommage. Quand l'ancien gardait sa
// référence, il ne devient pas orphelin — il devient un sosie, et les deux
// passent le contrôle précédent.
const groups = new Map();
for (const entry of entries) {
  const key = keyOf(entry);
  if (!defined.has(key)) continue;
  groups.set(key, [...(groups.get(key) ?? []), entry]);
}

const duplicates = [];
for (const [key, members] of groups) {
  if (members.length < 2) continue;
  const judged = members.filter(hasHumanWork);
  // Plusieurs avis sur une même référence : personne ne peut arbitrer d'ici
  // lequel fait foi. On liste, on ne touche à rien.
  const keep =
    judged.length === 1
      ? judged[0]
      : judged.length > 1
        ? null
        : members.reduce((a, b) => (a.testCase.id <= b.testCase.id ? a : b));
  duplicates.push({
    key,
    members,
    keep,
    extras: keep ? members.filter((m) => m !== keep && !hasHumanWork(m)) : [],
  });
}

const describe = (entry, prefix = '  ') => {
  const { testCase, runNames } = entry;
  const marque = workLabel(entry);
  console.log(`${prefix}#${testCase.id}  ${pathOf(testCase.folderId)}`);
  console.log(`${prefix}       ${String(testCase.title).slice(0, 96)}`);
  console.log(`${prefix}       ${runNames.join(', ') || 'aucune campagne'}${marque}`);
};

console.log(
  `\nProjet : ${project.name}  ·  ${seen.size} cas  ·  ${runs.length} campagne(s)  ·  pivot : ${payload.cases.length} cas\n`
);

if (orphans.length > 0) {
  console.log(`${orphans.length} cas que les plans ne définissent plus :\n`);
  for (const entry of orphans) describe(entry);
  console.log();
}

if (duplicates.length > 0) {
  console.log(`${duplicates.length} références portées par plusieurs cas :\n`);
  for (const { key, members, keep } of duplicates) {
    console.log(`  ${key.replace('||', ' / ')} — ${members.length} exemplaires`);
    for (const entry of members) {
      const role =
        keep === entry
          ? 'gardé'
          : keep === null
            ? 'à arbitrer'
            : hasHumanWork(entry)
              ? 'gardé (porte du travail)'
              : 'en trop';
      describe(entry, '    ');
      console.log(`           → ${role}`);
    }
  }
  console.log();
}

if (orphans.length === 0 && duplicates.length === 0) {
  console.log('Rien en trop : tout ce que porte l’instance est défini par les plans, une fois chacun.\n');
  process.exit(0);
}

// Les pièces jointes ne sont pas servies par la liste : on les demande cas par
// cas, et seulement pour les candidats. Mieux vaut quelques requêtes de plus que
// supprimer la capture d'écran qui prouvait un défaut.
const candidates = [...orphans.filter((e) => !hasHumanWork(e)), ...duplicates.flatMap((d) => d.extras)];
for (const entry of candidates) {
  const detail = await api('GET', `/cases/${entry.testCase.id}`).catch(() => null);
  entry.attachments = (detail?.Attachments ?? []).length;
  entry.comments = Math.max(entry.comments, (detail?.Comments ?? []).length);
}

const removable = candidates.filter((e) => !hasHumanWork(e));
const spared = candidates.filter(hasHumanWork);
if (spared.length > 0) {
  console.log(`${spared.length} candidat(s) écarté(s) : ils portent du travail — le détail est en regard.\n`);
  for (const entry of spared) describe(entry);
  console.log();
}
const manual = [
  ...orphans.filter(hasHumanWork),
  ...spared,
  ...duplicates.filter((d) => d.keep === null).flatMap((d) => d.members),
];

console.log(`${removable.length} supprimables, ${manual.length} à regarder à la main.`);
if (manual.length > 0) {
  console.log("Un cas qui porte le travail de quelqu'un n'est pas un déchet : il se traite dans l'interface.");
}

if (!DELETE) {
  console.log('\nRien n’a été supprimé. Relancer avec --delete pour effacer les supprimables.\n');
  process.exit(0);
}

if (removable.length === 0) {
  console.log('\nRien à supprimer.\n');
  process.exit(0);
}

if (removable.length > MAX_SUPPRIMABLES) {
  console.error(
    `\nRefus : ${removable.length} cas à supprimer, c’est trop pour un nettoyage.\n` +
      'Un tel nombre dit que le pivot ne correspond pas à cette instance — mauvais\n' +
      'projet, ou export d’une autre époque. Vérifier --cases et --project.\n'
  );
  process.exit(1);
}

await api('POST', '/cases/bulkdelete', {
  query: { projectId: project.id },
  body: { caseIds: removable.map(({ testCase }) => testCase.id) },
});
console.log(`\n${removable.length} cas supprimés.\n`);
