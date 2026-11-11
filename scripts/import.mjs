#!/usr/bin/env node
// Importe un fichier de cas de test dans une instance testing-book, par son API.
//
//   TCMS_PASSWORD=… node scripts/import.mjs \
//     --url=https://exemple.duckdns.org --email=toi@exemple.com
//
// Par l'API et non par le fichier SQLite : l'instance vit dans un volume Docker
// sur un serveur distant, qu'aucun script local ne peut ouvrir. C'est aussi ce
// qui permettra plus tard de déclencher un import depuis l'application
// elle-même, sans accès au serveur.
//
// Le mot de passe se lit dans l'environnement et n'apparaît jamais en argument :
// une ligne de commande est visible de tout le système.
//
// Idempotent : relancer met à jour les énoncés et crée ce qui manque, sans
// jamais réécrire un statut déjà saisi par un testeur.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// `xlsx` vit dans les dépendances du backend : la route d'import groupé ne
// prend qu'un classeur, et c'est elle qui rend cet import possible sous la
// limite de débit (voir plus bas).
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const XLSX = require('xlsx');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = (arg('url') ?? '').replace(/\/+$/, '');
// En production, `entrypoint.js` monte le backend derrière `/api`. En
// développement le backend écoute seul et sert ses routes à la racine : il faut
// alors passer `--api-path=` (vide).
const API_PATH = arg('api-path', '/api').replace(/\/+$/, '');
const EMAIL = arg('email');
const PASSWORD = process.env.TCMS_PASSWORD;
const CASES = resolve(arg('cases', new URL('../../focus-qa/out/cases.json', import.meta.url).pathname));
const DRY_RUN = process.argv.includes('--dry-run');

if (!BASE || !EMAIL || !PASSWORD) {
  console.error(
    'Usage : TCMS_PASSWORD=… node scripts/import.mjs --url=https://… --email=…\n' +
      '  --cases=<chemin>  le pivot à importer (défaut : ../focus-qa/out/cases.json)\n' +
      "  --api-path=<p>    préfixe de l'API (défaut : /api ; vide en développement)\n" +
      '  --dry-run         montre ce qui serait fait, sans rien écrire'
  );
  process.exit(1);
}

// --- Les entiers de l'application -------------------------------------------
// L'index du tableau dans `frontend/config/selection.ts` EST la valeur stockée.
// Les réordonner côté application casserait ces correspondances en silence.

// La route d'import groupé attend les noms, les routes unitaires les indices.
// Les deux viennent du MÊME tableau de `frontend/config/selection.ts` : y
// changer un ordre casserait les secondes en silence.
const MEMBER_ROLES = ['manager', 'developer', 'reporter'];
const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const TEST_TYPES = [
  'other',
  'security',
  'performance',
  'accessibility',
  'functional',
  'acceptance',
  'usability',
  'smokeSanity',
  'compatibility',
  'destructive',
  'regression',
  'automated',
  'manual',
];
const AUTOMATION_STATUS = ['automated', 'automation-not-required', 'cannot-be-automated', 'obsolete'];
const TEMPLATES = ['text', 'step'];

const PRIORITE_PAR_PLAN = { P0: 'high', P1: 'medium', P2: 'low' };
const MARQUEURS_CRITIQUES = ['securite', 'calcul', 'attention'];
const TYPE_PAR_MARQUEUR = {
  securite: 'security',
  calcul: 'functional',
  responsive: 'compatibility',
  pdf: 'acceptance',
  email: 'acceptance',
};
const TYPE_DEFAUT = 'acceptance'; // c'est une recette d'acceptation
// « on ne cherche pas à l'automatiser », et non « impossible à automatiser » :
// la recette est manuelle, et le reste.
const AUTOMATION_DEFAUT = 'automation-not-required';
const TEMPLATE_DEFAUT = 'text';
const STATE_DEFAUT = 0;

/** ⬜ untested · 🟢 passed · 🔴 failed · 🟠 retest · ⚪ ⛔ skipped */
const RUN_CASE_STATUS = { '⬜': 0, '🟢': 1, '🔴': 2, '🟠': 3, '⚪': 4, '⛔': 4 };
const RUN_STATE = { nouveau: 0, enCours: 1 };

const WAVE_TITLES = {
  0: "Vague 0 — Rendre l'environnement testable",
  1: "Vague 1 — Le portail et l'identité",
  2: 'Vague 2 — Le registre',
  3: 'Vague 3 — Les contrats',
  4: "Vague 4 — L'activité",
  5: 'Vague 5 — La paie',
  6: 'Vague 6 — Les ventes',
  7: "Vague 7 — L'autre côté, et le cloisonnement",
};
const WAVE_CONTINU = 'En continu — transverse';

// --- Client HTTP -------------------------------------------------------------

let token = null;

const api = async (method, path, { body, query } = {}) => {
  const url = new URL(`${BASE}${API_PATH}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : null;
};

// --- Transformation ----------------------------------------------------------

/**
 * Critique = cloisonnement, calcul, ou défaut déjà connu. Reporter la priorité
 * du plan telle quelle mettait 96 % des cas en « critical », et une priorité
 * que presque tout porte ne trie plus rien.
 */
const priorityOf = (c) =>
  c.markers.some((m) => MARQUEURS_CRITIQUES.includes(m)) ? 'critical' : (PRIORITE_PAR_PLAN[c.priority] ?? 'medium');

const typeOf = (markers) => {
  for (const m of ['securite', 'calcul', 'responsive', 'pdf', 'email']) {
    if (markers.includes(m)) return TYPE_PAR_MARQUEUR[m];
  }
  return TYPE_DEFAUT;
};

/** L'énoncé débarrassé du balisage que l'interface n'affiche pas. */
const plainText = (md) =>
  (md ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// --- Import ------------------------------------------------------------------

const payload = JSON.parse(readFileSync(CASES, 'utf-8'));
const stats = { folders: 0, cases: 0, updated: 0, inchanges: 0, runs: 0, runCases: 0, kept: 0, roles: 0, avis: 0 };

const log = (s) => process.stdout.write(s);

console.log(`Instance : ${BASE}`);
console.log(`Pivot    : ${payload.cases.length} cas, ${payload.plans.length} plans\n`);

if (DRY_RUN) {
  console.log('À blanc — rien ne sera écrit.');
  process.exit(0);
}

const signin = await api('POST', '/users/signin', { body: { email: EMAIL, password: PASSWORD } });
token = signin.access_token;
const me = await api('GET', '/users/me').catch(() => null);
console.log(`Connecté : ${me?.username ?? EMAIL}\n`);

// Projet
const projects = await api('GET', '/projects');
let project = (Array.isArray(projects) ? projects : (projects?.projects ?? [])).find(
  (p) => p.name === payload.project.name
);
if (!project) {
  project = await api('POST', '/projects', {
    body: { name: payload.project.name, detail: payload.project.detail, isPublic: false },
  });
  console.log(`Projet créé : « ${project.name} » (#${project.id})`);
} else {
  console.log(`Projet réutilisé : « ${project.name} » (#${project.id})`);
}

// Dossiers : un par plan, un sous-dossier par section
const existingFolders = await api('GET', '/folders', { query: { projectId: project.id } });
const folderByName = new Map(
  (Array.isArray(existingFolders) ? existingFolders : []).map((f) => [`${f.parentFolderId ?? 0}/${f.name}`, f])
);

const ensureFolder = async (name, detail, parentFolderId) => {
  const key = `${parentFolderId ?? 0}/${name}`;
  if (folderByName.has(key)) return folderByName.get(key);
  const folder = await api('POST', '/folders', {
    query: { projectId: project.id },
    body: { name, detail: detail ?? null, parentFolderId: parentFolderId ?? null },
  });
  folderByName.set(key, folder);
  stats.folders += 1;
  return folder;
};

log('Dossiers ');
const planFolder = new Map();
for (const p of payload.plans) {
  const detail = `${p.domaine} · ${p.priorite} · ${p.cases} cas · ${
    p.wave === null ? 'en continu' : `vague ${p.wave}`
  } · dépôts : ${p.depots} · source : plans/${p.file}`;
  planFolder.set(p.plan, await ensureFolder(`${p.plan} — ${p.title}`, detail.slice(0, 480), null));
  log('.');
}
log(` ${stats.folders} créés\n`);

// Campagnes, créées AVANT les cas
//
// `GET /cases/byproject` exige un runId EXISTANT : sans campagne en base, la
// relecture échoue, et l'import ne voit pas les cas déjà présents — il les
// dupliquerait à chaque relance. Les campagnes ne dépendent pas des cas ; seul
// leur rattachement en dépend.
log('Campagnes');
const existingRuns = await api('GET', '/runs', { query: { projectId: project.id } });
const runByName = new Map((Array.isArray(existingRuns) ? existingRuns : []).map((r) => [r.name, r]));

const waves = [...new Set(payload.cases.map((c) => c.wave))].sort((a, b) => (a === null ? 1 : b === null ? -1 : a - b));
const runParVague = new Map();
for (const wave of waves) {
  const name = wave === null ? WAVE_CONTINU : WAVE_TITLES[wave];
  const members = payload.cases.filter((c) => c.wave === wave);
  const plans = [...new Set(members.map((c) => c.plan))].sort();
  let run = runByName.get(name);
  if (!run) {
    run = await api('POST', '/runs', {
      query: { projectId: project.id },
      body: {
        name,
        configurations: 'staging',
        description: `Plans ${plans.join(', ')} · ${members.length} cas · recette manuelle, un cas n'est validé que VU.`,
        state: wave === null ? RUN_STATE.enCours : RUN_STATE.nouveau,
      },
    });
    stats.runs += 1;
  }
  runParVague.set(wave, run);
  log('.');
}
const runReference = runParVague.values().next().value;
log(` ${stats.runs} créées\n`);

// Cas
//
// L'API limite à 1000 requêtes par heure et par IP. Créer les cas un par un en
// demanderait plus de 1100 pour ce seul jeu : l'import échouerait à mi-parcours,
// par construction. La route d'import groupé prend un classeur par dossier et
// fait un `bulkCreate` — une requête pour toute une section. On retombe sous
// les 250 requêtes.
log('Cas      ');
const toutLesCas = await api('GET', '/cases/byproject', {
  query: { projectId: project.id, runId: runReference.id },
});
// Indexé par DOSSIER + titre, et non par titre seul : des plans différents
// portent des cas de même identifiant — `PRE-02` existe dans le plan 05 et dans
// le plan 14. Avec une clé sur le seul titre, les deux n'en font qu'un : ils
// s'écrasent l'un l'autre à chaque import, et leur rattachement aux campagnes
// désigne le mauvais cas.
const cle = (folderId, ref) => `${folderId}/${ref}`;

// Rapprochés sur l'IDENTIFIANT, pas sur le titre. Le titre dérive de l'énoncé :
// le reformuler en changeait la clé, et l'import créait alors un cas neuf en
// abandonnant l'ancien — avec son statut, ses commentaires et ses pièces. Les
// identifiants, eux, sont stables à vie (docs/conventions.md).
const refDuTitre = (titre) => (titre ?? '').split(' — ')[0].trim();
const casParCle = new Map();
const doublons = [];
// Les cas déjà joués dont le texte change : signalés, jamais réinitialisés.
const joues = [];

// Des imports antérieurs ont pu laisser deux cas pour un même identifiant. On
// garde celui qui porte un STATUT — c'est là qu'est le travail de la testeuse —
// et à défaut le plus ancien. L'autre est signalé, jamais supprimé : il peut
// porter des commentaires ou des pièces que seul un humain sait arbitrer.
const aUnStatut = (c) => (c.RunCases ?? []).some((rc) => rc.status && rc.status !== 0);
for (const c of Array.isArray(toutLesCas) ? toutLesCas : []) {
  const k = cle(c.folderId, refDuTitre(c.title));
  const garde = casParCle.get(k);
  if (!garde) {
    casParCle.set(k, c);
    continue;
  }
  const remplace = aUnStatut(c) && !aUnStatut(garde);
  casParCle.set(k, remplace ? c : garde);
  doublons.push(remplace ? garde : c);
}

const ligneExcel = (c) => ({
  title: `${c.ref} — ${c.title}`.slice(0, 250),
  description: plainText(c.statement).slice(0, 2000),
  priority: priorityOf(c),
  type: typeOf(c.markers),
  template: TEMPLATE_DEFAUT,
  automationStatus: AUTOMATION_DEFAUT,
  preConditions: plainText(c.preConditions).slice(0, 1000),
  expectedResults: plainText(c.expectedResults).slice(0, 1000),
});

const televerser = async (folderId, lignes) => {
  const sheet = XLSX.utils.json_to_sheet(lignes);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'cases');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });

  const form = new FormData();
  // `multer` contrôle le type MIME ET l'extension : un Blob sans type est
  // refusé, même nommé « .xlsx ».
  form.append(
    'file',
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'cases.xlsx'
  );
  const url = new URL(`${BASE}${API_PATH}/cases/import`);
  url.searchParams.set('folderId', folderId);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /cases/import → ${res.status} ${(await res.text()).slice(0, 200)}`);
};

// Regrouper par dossier de section avant d'écrire quoi que ce soit
const sectionFolder = new Map();
const parSection = new Map();
for (const c of payload.cases) {
  const parent = planFolder.get(c.plan);
  const key = `${c.plan}/${c.section}`;
  if (!sectionFolder.has(key)) {
    // Un plan sans sections (l'exportateur met alors `section` = numéro du plan)
    // n'a pas de sous-dossier : en créer un donnerait au dossier enfant le nom
    // exact de son parent, et le tableau d'une campagne — qui ne montre que les
    // cas directement dans le dossier choisi — serait vide.
    sectionFolder.set(
      key,
      c.section === c.plan
        ? parent
        : await ensureFolder(`${c.section} — ${c.sectionTitle}`.slice(0, 200), null, parent.id)
    );
  }
  const folderId = sectionFolder.get(key).id;
  if (!parSection.has(folderId)) parSection.set(folderId, []);
  parSection.get(folderId).push(c);
}

for (const [folderId, cas] of parSection) {
  const nouveaux = cas.filter((c) => !casParCle.has(cle(folderId, c.ref)));
  if (nouveaux.length) {
    await televerser(folderId, nouveaux.map(ligneExcel));
    stats.cases += nouveaux.length;
  }
  // Les cas déjà présents se mettent à jour un par un — ils sont rares après le
  // premier import, et la route groupée ne sait que créer.
  for (const c of cas.filter((x) => casParCle.has(cle(folderId, x.ref)))) {
    const existant = casParCle.get(cle(folderId, c.ref));
    const l = ligneExcel(c);
    const identique =
      existant.title === l.title &&
      existant.description === l.description &&
      existant.priority === PRIORITIES.indexOf(l.priority) &&
      existant.type === TEST_TYPES.indexOf(l.type) &&
      (existant.preConditions ?? '') === l.preConditions &&
      (existant.expectedResults ?? '') === l.expectedResults;
    if (identique) {
      stats.inchanges += 1;
      continue;
    }
    if (aUnStatut(existant)) {
      joues.push({ id: existant.id, titre: l.title, ref: c.ref, plan: c.plan });
    }
    await api('PUT', `/cases/${existant.id}`, {
      query: { folderId },
      body: {
        title: l.title,
        state: STATE_DEFAUT,
        priority: PRIORITIES.indexOf(l.priority),
        type: TEST_TYPES.indexOf(l.type),
        automationStatus: AUTOMATION_STATUS.indexOf(l.automationStatus),
        description: l.description,
        template: TEMPLATES.indexOf(l.template),
        preConditions: l.preConditions || null,
        expectedResults: l.expectedResults || null,
      },
    });
    stats.updated += 1;
  }
  log('.');
}

// Relire une fois pour connaître les identifiants attribués aux nouveaux cas
const casFinaux = await api('GET', '/cases/byproject', { query: { projectId: project.id, runId: runReference.id } });
const idParCle = new Map(
  (Array.isArray(casFinaux) ? casFinaux : []).map((c) => [cle(c.folderId, refDuTitre(c.title)), c.id])
);
const caseIdByRef = new Map(
  payload.cases.map((c) => [
    `${c.plan}/${c.ref}`,
    idParCle.get(cle(sectionFolder.get(`${c.plan}/${c.section}`).id, c.ref)),
  ])
);
const orphelins = [...caseIdByRef.entries()].filter(([, id]) => !id);
if (orphelins.length) {
  console.error(`\n${orphelins.length} cas introuvables après import — ex. ${orphelins[0][0]}`);
  process.exit(1);
}
log(` ${stats.cases} créés, ${stats.updated} mis à jour, ${stats.inchanges} inchangés\n`);

stats.joues = joues.length;
if (joues.length) {
  console.log(
    `\n⚠ ${joues.length} cas DÉJÀ JOUÉS ont vu leur énoncé, leurs préconditions ou leur attendu changer.\n` +
      '  Les avis déjà posés répondaient donc à une autre question.\n' +
      "  Rien n'est réinitialisé : une correction de forme ne vaut pas un rejeu, un changement de fond si.\n" +
      '  À arbitrer, puis « Remettre à faire » sur ceux qui le méritent :'
  );
  for (const j of joues.slice(0, 20)) {
    console.log(`    ${j.plan}/${j.ref} — ${j.titre.slice(0, 80)}`);
  }
  if (joues.length > 20) {
    console.log(`    … et ${joues.length - 20} autres`);
  }
  console.log('');
}

stats.doublons = doublons.length;
if (doublons.length) {
  console.log(
    `\n⚠ ${doublons.length} cas en double, hérités d'un import antérieur qui rapprochait sur le titre.\n` +
      '  Ils ne sont PAS supprimés : ils peuvent porter un statut, des commentaires ou des pièces.\n' +
      '  À arbitrer à la main :'
  );
  for (const d of doublons.slice(0, 20)) {
    console.log(`    #${d.id} ${d.title}`);
  }
  if (doublons.length > 20) {
    console.log(`    … et ${doublons.length - 20} autres`);
  }
  console.log('');
}

// Les cas marqués 🛠 dans les plans demandent la base, le serveur ou la
// configuration : ils reviennent à l'équipe technique, et l'interface les
// retire de la liste du rapporteur.
//
// Les plans font autorité dans les DEUX sens : un cas marqué est confié, un cas
// non marqué est rendu à tout le monde. Sans ce second sens, un rôle posé à la
// main par erreur ne serait jamais rattrapé — et il l'a déjà été.
const DEVELOPPEUR = MEMBER_ROLES.indexOf('developer');
const roleActuel = new Map((Array.isArray(casFinaux) ? casFinaux : []).map((c) => [c.id, c.ownerRole ?? null]));

const aCorriger = new Map([
  [DEVELOPPEUR, []],
  [null, []],
]);
for (const c of payload.cases) {
  const id = caseIdByRef.get(`${c.plan}/${c.ref}`);
  const voulu = c.markers.includes('dev') ? DEVELOPPEUR : null;
  if (id && roleActuel.get(id) !== voulu) {
    aCorriger.get(voulu).push(id);
  }
}

// Par paquets : SQLite refuse une clause `IN` de mille valeurs, et un import
// complet en compte autant.
const PAQUET = 400;
let rolesAlignes = 0;
for (const [ownerRole, ids] of aCorriger) {
  for (let i = 0; i < ids.length; i += PAQUET) {
    const lot = ids.slice(i, i + PAQUET);
    await api('PUT', '/cases/role', {
      query: { projectId: project.id },
      body: { caseIds: lot, ownerRole },
    });
    rolesAlignes += lot.length;
  }
}
stats.roles = rolesAlignes;
log(rolesAlignes ? ` ${rolesAlignes} rôle(s) alignés sur les plans\n` : ' rôles déjà conformes aux plans\n');

// Combien d'avis distincts chaque cas demande. Deux sur les cas de calcul et de
// cloisonnement, un seul ailleurs — et les plans en décident, dans les DEUX sens
// comme pour le rôle : un marqueur retiré d'un énoncé ramène son cas à un avis.
log('Avis     ');
const attenduActuel = new Map((Array.isArray(casFinaux) ? casFinaux : []).map((c) => [c.id, c.verdictsExpected ?? 1]));

const parObjectif = new Map();
for (const c of payload.cases) {
  const id = caseIdByRef.get(`${c.plan}/${c.ref}`);
  const voulu = c.verdictsExpected ?? 1;
  if (id && attenduActuel.get(id) !== voulu) {
    if (!parObjectif.has(voulu)) {
      parObjectif.set(voulu, []);
    }
    parObjectif.get(voulu).push(id);
  }
}

let avisAlignes = 0;
for (const [verdictsExpected, ids] of parObjectif) {
  for (let i = 0; i < ids.length; i += PAQUET) {
    const lot = ids.slice(i, i + PAQUET);
    await api('PUT', '/cases/verdicts-expected', {
      query: { projectId: project.id },
      body: { caseIds: lot, verdictsExpected },
    });
    avisAlignes += lot.length;
  }
}
stats.avis = avisAlignes;
log(avisAlignes ? ` ${avisAlignes} objectif(s) d'avis alignés sur les plans\n` : " objectifs d'avis déjà conformes\n");

// Rattachement des cas aux campagnes
log('Rattach. ');
for (const [wave, run] of runParVague) {
  const members = payload.cases.filter((c) => c.wave === wave);
  const attached = await api('GET', '/runcases', { query: { runId: run.id } }).catch(() => []);
  const already = new Set((Array.isArray(attached) ? attached : []).map((rc) => rc.caseId));

  // Un statut déjà saisi dans l'outil fait foi : c'est lui la vérité des
  // statuts. On ne le réécrit jamais depuis les plans.
  const toCreate = members
    .filter((c) => !already.has(caseIdByRef.get(`${c.plan}/${c.ref}`)))
    .map((c) => ({
      caseId: caseIdByRef.get(`${c.plan}/${c.ref}`),
      status: RUN_CASE_STATUS[c.staging.mark] ?? 0,
      editState: 'new',
    }));
  stats.kept += members.length - toCreate.length;

  if (toCreate.length) {
    await api('POST', '/runcases/update', { query: { runId: run.id }, body: toCreate });
    stats.runCases += toCreate.length;
  }
  log('.');
}
log(` ${stats.runCases} cas rattachés, ${stats.kept} statuts conservés\n`);

console.log(`\nTerminé.`);
console.log(`  dossiers créés    ${stats.folders}`);
console.log(`  cas créés         ${stats.cases}`);
console.log(`  cas mis à jour    ${stats.updated}`);
console.log(`  rôles alignés     ${stats.roles ?? 0}`);
console.log(`  objectifs d'avis  ${stats.avis ?? 0}`);
console.log(`  cas en double     ${stats.doublons ?? 0}`);
console.log(`  joués & modifiés  ${stats.joues ?? 0}`);
console.log(`  cas inchangés     ${stats.inchanges}`);
console.log(`  campagnes créées  ${stats.runs}`);
console.log(`  cas rattachés     ${stats.runCases}`);
console.log(`  statuts conservés ${stats.kept}`);
console.log(`\n${BASE}/fr/projects/${project.id}/home`);
