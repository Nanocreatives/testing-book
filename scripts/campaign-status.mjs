// Lit l'avancement d'une instance testing-book. NE MODIFIE RIEN.
//
//   TCMS_PASSWORD=… node scripts/campaign-status.mjs \
//     --url=https://exemple.duckdns.org --email=toi@exemple.com
//
// À lancer AVANT un import qui réécrit des énoncés : un cas déjà jugé dont la
// question change doit être rejoué, et c'est une décision humaine. Encore
// faut-il savoir lesquels le sont, et par qui.
//
// Par l'API et non par le fichier SQLite, pour la même raison que l'import :
// une instance déployée vit dans un volume Docker sur un serveur distant.

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = (arg('url') ?? '').replace(/\/+$/, '');
const API_PATH = arg('api-path', '/api').replace(/\/+$/, '');
const EMAIL = arg('email');
const PASSWORD = process.env.TCMS_PASSWORD;
const PROJECT_NAME = arg('project');

if (!BASE || !EMAIL || !PASSWORD) {
  console.error(
    'Usage : TCMS_PASSWORD=… node scripts/campaign-status.mjs --url=https://… --email=…\n' +
      '  --project=<nom>   le projet à lire (défaut : le plus récent qui parle de Focus)\n' +
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

const session = await api('POST', '/users/signin', { body: { email: EMAIL, password: PASSWORD } });
token = session.access_token ?? session.token ?? session.accessToken;
if (!token) {
  throw new Error('Pas de jeton dans la réponse de connexion');
}

const projects = rows(await api('GET', '/projects'));
const project = PROJECT_NAME
  ? projects.find((p) => p.name === PROJECT_NAME)
  : (projects.findLast?.((p) => /focus/i.test(p.name)) ?? projects[projects.length - 1]);

if (!project) {
  console.error('Projets disponibles :', projects.map((p) => p.name).join(' | '));
  process.exit(1);
}

// Un `reporter` ne reçoit de `/cases/byproject` que les cas de son ressort,
// quand `GET /runs/:id` compte toute la campagne. Les colonnes se
// contrediraient sans que rien ne le dise — et un chiffre faux mais plausible
// est précisément ce que ce script existe pour éviter.
const REPORTER_ROLE = 2;
const memberships = rows(await api('GET', '/members/check'));
const membership = memberships.find((m) => Number(m.projectId) === Number(project.id));

if (membership && !membership.isOwner && membership.role === REPORTER_ROLE) {
  console.error(
    `\nLe compte ${EMAIL} est « reporter » sur « ${project.name} ».\n\n` +
      'La liste des cas lui est filtrée : il ne voit que les siens, alors que le\n' +
      'comptage des avis porte sur toute la campagne. Les colonnes se\n' +
      'contrediraient.\n\n' +
      'Relancer avec un compte gestionnaire ou propriétaire du projet.'
  );
  process.exit(1);
}

console.log(`\nProjet : ${project.name}  (id ${project.id})\n`);

/** L'index EST la valeur stockée — `frontend/config/selection.ts`. */
const STATUS_LABELS = ['non testé', 'réussi', 'échoué', 'à rejouer', 'ignoré'];
const labelOf = (status) => STATUS_LABELS[status] ?? `statut ${status}`;

const runs = rows(await api('GET', '/runs', { query: { projectId: project.id } }));

const byJudge = new Map();
let totalCases = 0;
let totalPlayed = 0;

const head = [
  'Campagne'.padEnd(46),
  'cas'.padStart(5),
  'joués'.padStart(6),
  'désac.'.padStart(7),
  'attente'.padStart(8),
];
console.log(head.join(' '));
console.log('-'.repeat(76));

for (const run of runs) {
  // Une instance antérieure au comptage par avis ne sert pas ces trois nombres.
  const tally = await api('GET', `/runs/${run.id}`).catch(() => null);

  const cases = rows(await api('GET', '/cases/byproject', { query: { projectId: project.id, runId: run.id } }));
  const runCases = cases
    .flatMap((testCase) => testCase.RunCases ?? [])
    .filter((rc) => Number(rc.runId) === Number(run.id));

  const played = runCases.filter((rc) => rc.status !== 0).length;
  totalCases += runCases.length;
  totalPlayed += played;

  // Les auteurs ne sont servis que par une instance qui porte la PR #4.
  for (const runCase of runCases) {
    for (const verdict of runCase.Verdicts ?? []) {
      const name = verdict.username || `#${verdict.userId}`;
      const entry = byJudge.get(name) ?? { verdicts: 0, byStatus: {} };
      entry.verdicts += 1;
      entry.byStatus[labelOf(verdict.status)] = (entry.byStatus[labelOf(verdict.status)] ?? 0) + 1;
      byJudge.set(name, entry);
    }
  }

  console.log(
    [
      String(run.name).slice(0, 46).padEnd(46),
      String(runCases.length).padStart(5),
      String(played).padStart(6),
      String(tally?.disagreeing ?? '—').padStart(7),
      String(tally?.awaitingVerdicts ?? '—').padStart(8),
    ].join(' ')
  );
}

console.log('-'.repeat(76));
console.log(['TOTAL'.padEnd(46), String(totalCases).padStart(5), String(totalPlayed).padStart(6)].join(' '));

if (byJudge.size > 0) {
  console.log('\nQui a jugé');
  for (const [name, entry] of [...byJudge].sort((a, b) => b[1].verdicts - a[1].verdicts)) {
    const detail = Object.entries(entry.byStatus)
      .map(([label, count]) => `${count} ${label}`)
      .join(', ');
    console.log(`  ${name.padEnd(28)} ${String(entry.verdicts).padStart(4)} avis   (${detail})`);
  }
} else if (totalPlayed > 0) {
  console.log(
    "\nDes cas sont joués mais aucun auteur n'est renvoyé : l'instance est" +
      '\nantérieure à la PR #4, qui expose les auteurs dans la liste des cas.'
  );
} else {
  console.log("\nAucun cas joué : rien n'est à arbitrer avant un import.");
}

console.log();
