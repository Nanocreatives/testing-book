#!/usr/bin/env node
// Pose le parcours guidé d'un projet testing-book : les lectures d'accueil, puis
// les campagnes dans l'ordre où elles doivent être jouées.
//
//   TCMS_PASSWORD=… node scripts/seed-path.mjs \
//     --url=https://exemple.duckdns.org --email=toi@exemple.com
//
// Par l'API et non par le fichier SQLite, pour la même raison que l'import :
// l'instance vit dans un volume Docker sur un serveur distant.
//
// Le mot de passe se lit dans l'environnement et n'apparaît jamais en argument :
// une ligne de commande est visible de tout le système.
//
// Idempotent : relancer met à jour les textes et l'ordre. Ce qu'un testeur a
// déjà coché reste coché — l'accusé de lecture est attaché à l'étape, pas à son
// contenu.

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = (arg('url') ?? '').replace(/\/+$/, '');
// En production, `entrypoint.js` monte le backend derrière `/api`. En
// développement le backend écoute seul : il faut alors passer `--api-path=`.
const API_PATH = arg('api-path', '/api').replace(/\/+$/, '');
const EMAIL = arg('email');
const PASSWORD = process.env.TCMS_PASSWORD;
const PROJECT = arg('project', 'Focus — Recette finale');
const DRY_RUN = process.argv.includes('--dry-run');

if (!BASE || !EMAIL || !PASSWORD) {
  console.error(
    'Usage : TCMS_PASSWORD=… node scripts/seed-path.mjs --url=https://… --email=…\n' +
      '  --project=<nom>   le projet à équiper (défaut : « Focus — Recette finale »)\n' +
      "  --api-path=<p>    préfixe de l'API (défaut : /api ; vide en développement)\n" +
      '  --dry-run         montre ce qui serait fait, sans rien écrire'
  );
  process.exit(1);
}

// L'index du tableau dans `frontend/config/selection.ts` EST la valeur stockée.
const BRIEFING = 0;
const RUN = 1;

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

// --- Le parcours -------------------------------------------------------------

const BRIEFINGS = [
  {
    title: 'Bienvenue, et la seule règle qui compte',
    content: `Tu vas vérifier la suite Focus avant qu'elle soit livrée. Pas en lisant du code : en l'utilisant, comme le ferait l'entreprise à qui on la remet.

La seule règle qui compte : un cas n'est validé que si tu l'as VU.

Pas « ça devrait marcher ». Pas « c'est sûrement bon puisque le reste l'est ». Tu as regardé, tu as vu le résultat attendu, tu coches.

Si tu n'as pas pu le vérifier — un bouton absent, une donnée manquante, un écran qui ne s'ouvre pas — ne mets pas Réussi. Mets Ignoré et dis pourquoi en commentaire. Un cas non joué signalé est utile ; un cas coché sans avoir été vu est pire que rien, parce qu'il endort tout le monde.

Tu testes sur staging, jamais sur la production : crée, modifie, supprime sans crainte, tu ne peux rien casser d'important.`,
  },
  {
    title: 'Les cinq statuts, et quoi faire quand ça rate',
    content: `Non testé — pas encore joué, l'état de départ.
Réussi — tu as vu ce qui était attendu.
Échoué — tu as vu autre chose. Commente, toujours.
À retester — un correctif est annoncé, à rejouer après.
Ignoré — tu n'as pas pu le jouer. Dis pourquoi.

Quand quelque chose ne va pas, trois gestes dans cet ordre :

1. Mets le statut sur Échoué.
2. Commente le cas : ce que tu attendais, ce que tu as vu. « J'attendais le total en francs, j'ai vu NaN. » Une phrase suffit.
3. Joins une capture d'écran. C'est la preuve ; sans elle, on doit te croire sur parole et refaire le chemin.

Ne cherche pas à expliquer pourquoi ça rate — ce n'est pas ton travail. Décris ce que tu as vu, c'est tout ce dont on a besoin.`,
  },
  {
    title: 'Lire un cas, et quelques repères',
    content: `Chaque cas porte trois choses :

Préconditions — ce qui doit être vrai avant. Si ce n'est pas le cas, n'invente pas : signale-le.
Description — ce que tu fais.
Résultat attendu — ce que tu dois voir. C'est lui qui tranche.

La priorité dit lesquels comptent le plus. Critique : un calcul d'argent, une question d'accès, ou un défaut déjà connu qu'on revérifie — ne les saute jamais. Puis Élevée, Moyenne, Faible, dans cet ordre si tu manques de temps.

Quelques repères :

Si un cas parle d'un montant, vérifie le montant, pas seulement que l'écran s'affiche.
Si un cas mentionne un email, ouvre la boîte — et regarde dans les spams.
Certains cas sont déjà verts : ils ont été joués avant que cet outil existe. Ne les rejoue pas.
Un cas corrigé se rejoue dans sa situation d'origine ; il ne se déduit pas d'un correctif annoncé. Deux cas sont restés verts à tort comme ça, et ça a coûté deux semaines.

Si tu bloques, écris-nous. Un cas mal compris, un prérequis introuvable, un écran qui ne ressemble pas à ce qui est décrit : ce sont des informations utiles, pas des dérangements. Mieux vaut une question que dix cas cochés au hasard.`,
  },
  {
    title: 'Vague 0 : ce que l’équipe prépare, et tes quatre cas',
    content: `La vague 0 ne teste pas le produit. Elle établit que l'environnement est en état d'être testé — sans elle, un tiers de la campagne rendrait des erreurs qui ne sont pas des défauts.

Huit de ses douze cas sont du travail d'équipe, pas le tien : ENV-01 à ENV-06, ENV-11 et ENV-12 demandent d'ouvrir la base, le serveur ou la configuration. On les joue ensemble, et c'est nous qui les cochons.

Quatre sont à ta portée, et ce sont ceux qu'on te demande :

ENV-07 — ouvre les deux boîtes mail, la professionnelle et celle de contact, et vérifie que tu y accèdes. Regarde aussi dans les spams.
ENV-08 — ouvre la liste des collaborateurs et vérifie que les huit personas existent. P6 et P7 viennent d'être posés : ils doivent être là tous les deux.
ENV-09 — vérifie qu'une période de paie est ouverte.
ENV-10 — vérifie les réglages de l'organisation : soumission d'activité activée, délai à 5 jours, calendrier des jours fériés chargé pour l'année en cours.

Ne commence pas seule : préviens-nous, on ouvre la vague 0 ensemble. C'est la seule étape où on travaille à deux.`,
  },
];

// Les campagnes dans l'ordre où le produit les fabrique : un bulletin ne se
// vérifie pas avant qu'un contrat existe, ni un contrat avant une fiche.
// « En continu » vient en dernier parce qu'elle ne se joue jamais d'un bloc —
// placée avant une vague, elle la bloquerait sans raison.
const WAVES = [
  {
    match: 'Vague 0',
    instructions: `On la joue ensemble : préviens-nous avant de commencer.

Huit cas sur douze sont du travail d'équipe — ENV-01 à ENV-06, ENV-11, ENV-12. Ne les coche pas seule.

Les quatre qui te reviennent : ENV-07 (les deux boîtes mail), ENV-08 (les huit personas, P6 et P7 compris), ENV-09 (une période de paie ouverte), ENV-10 (les réglages de l'organisation).

Aucun cas de cette vague ne doit rester en Échoué quand on passe à la suite : un prérequis rouge fausse tout le reste.`,
  },
  {
    match: 'Vague 1',
    instructions: `Prérequis : la vague 0 terminée.

Commence par les cas du plan 16 (identité et permissions), puis le portail, puis l'onboarding. Le plan 16 fait autorité sur l'identité ; le jouer après les autres, c'est tout rejouer.

Les paragraphes §0 du plan 16 sont un préambule : à lire, pas à cocher. Mets-les en Ignoré.

Les cas GRD et DBL du portail sont les plus importants de la vague : ils touchent ce qui se passe juste après la connexion. Regarde-les deux fois.

L'onboarding se joue sur une organisation neuve, créée pour l'occasion : c'est la seule façon de voir ce que voit un client le premier jour, et ça fabrique le terrain des vagues suivantes.`,
  },
  {
    match: 'Vague 2',
    instructions: `Prérequis : la vague 1 terminée.

Crée les huit personas par le produit, pas par un script : la création de fiche se recette en créant les fiches dont la suite a besoin.

L'invitation, l'ouverture d'accès et l'import ont déjà été vus en vague 1. Si un cas te semble déjà joué là-bas, mets Ignoré et dis-le plutôt que de le rejouer.`,
  },
  {
    match: 'Vague 3',
    instructions: `Prérequis : les fiches créées en vague 2.

Les avenants sont presque finis — 68 cas sont déjà verts. Il ne reste que les cas qui ratent exprès, le cloisonnement et le reçu de signature.

La fin de contrat a déjà été vue en vague 1 : ne la rejoue pas.

Les documents signés passent par un email avec un code : ouvre la boîte de contact, et regarde dans les spams.`,
  },
  {
    match: 'Vague 4',
    instructions: `Prérequis : les contrats créés en vague 3.

Tiens un carnet des nombres. Chaque compteur que tu relèves ici — taux de présence, heures, soldes — sera confronté à la paie en vague 5 et à l'espace salarié en vague 7. Un nombre noté une fois sert trois fois.`,
  },
  {
    match: 'Vague 5',
    instructions: `Prérequis : l'activité de la vague 4 saisie et validée.

Commence par les réglages — charges, calendrier, compensations : la paie les consomme. Puis une session de paie complète, de l'initialisation au bulletin.

Les cas de calcul se jouent avec le barème officiel sous les yeux et une calculatrice. Vérifie le montant, pas seulement que l'écran s'affiche. C'est la vague la plus lente, et la plus utile.

Cinq écarts de calcul sont déjà connus et en attente de décision. Si tu en retrouves un, mets Échoué et commente quand même : c'est ce qui les fait trancher.`,
  },
  {
    match: 'Vague 6',
    instructions: `Indépendante des autres : rien de ce qui précède ne lui manque.

Attention aux cas de facturation certifiée, FAC-10 à FAC-14 : la mention « bac à sable » doit être visible à l'écran, et quand la plateforme est indisponible, l'envoi doit être fermé — pas silencieux.`,
  },
  {
    match: 'Vague 7',
    instructions: `Prérequis : tout ce que les vagues 2 à 5 ont fabriqué.

C'est le plus gros poste, mais il va vite : on vérifie ce qui est annoncé comme marchant, on ne découvre pas.

Garde les permissions pour la fin et joue-les d'une traite : chaque cas demande de changer de compte. Grouper les changements de persona économise la moitié du temps.`,
  },
  {
    match: 'En continu',
    instructions: `Ne consacre jamais une session à cette campagne. Elle se remplit en passant : chaque fois que tu croises un libellé en anglais, un écran vide sans explication, un affichage bizarre ou un NaN, note-le dans le cas qui correspond.

Relis-la en fin de campagne pour ce que tu n'as pas rencontré.`,
  },
];

// --- Application -------------------------------------------------------------

console.log(`Instance : ${BASE}`);
console.log(`Projet   : ${PROJECT}\n`);

const signin = await api('POST', '/users/signin', { body: { email: EMAIL, password: PASSWORD } });
token = signin.access_token;
const me = await api('GET', '/users/me').catch(() => null);
console.log(`Connecté : ${me?.username ?? EMAIL}\n`);

const projects = await api('GET', '/projects');
const project = (Array.isArray(projects) ? projects : (projects?.projects ?? [])).find((p) => p.name === PROJECT);
if (!project) {
  console.error(`Projet introuvable : « ${PROJECT} »`);
  process.exit(1);
}

const runs = await api('GET', '/runs', { query: { projectId: project.id } });
const existing = await api('GET', '/stages', { query: { projectId: project.id } });

// L'ordre voulu, lectures d'abord. Une campagne absente est signalée et sautée :
// mieux vaut un parcours incomplet qu'un parcours qui pointe dans le vide.
const wanted = [
  ...BRIEFINGS.map((b) => ({ kind: BRIEFING, title: b.title, content: b.content, runId: null, instructions: null })),
];
for (const wave of WAVES) {
  const run = runs.find((r) => r.name.startsWith(wave.match));
  if (!run) {
    console.warn(`  ! campagne introuvable, étape sautée : « ${wave.match} »`);
    continue;
  }
  wanted.push({
    kind: RUN,
    title: run.name,
    content: null,
    runId: run.id,
    instructions: wave.instructions,
  });
}

if (DRY_RUN) {
  console.log('À blanc — rien ne sera écrit.\n');
  wanted.forEach((stage, index) => {
    console.log(`  ${index + 1}. ${stage.kind === BRIEFING ? '📖' : '🧪'} ${stage.title}`);
  });
  process.exit(0);
}

const stats = { created: 0, updated: 0, instructions: 0 };
const ordered = [];

for (const stage of wanted) {
  const already = existing.find((s) => s.title === stage.title);
  if (already) {
    await api('PUT', `/stages/${already.id}`, {
      body: { title: stage.title, content: stage.content, runId: stage.runId },
    });
    ordered.push(already.id);
    stats.updated += 1;
  } else {
    const created = await api('POST', '/stages', {
      query: { projectId: project.id },
      body: { kind: stage.kind, title: stage.title, content: stage.content, runId: stage.runId },
    });
    ordered.push(created.id);
    stats.created += 1;
  }

  if (stage.instructions) {
    await api('PUT', `/runs/${stage.runId}`, { body: { instructions: stage.instructions } });
    stats.instructions += 1;
  }
}

// Les étapes posées à la main restent, à la fin : les retirer ici effacerait le
// travail de quelqu'un d'autre. La route de réordonnancement exige la liste
// entière, sans quoi deux étapes revendiqueraient le même rang.
for (const stage of existing) {
  if (!ordered.includes(stage.id)) {
    ordered.push(stage.id);
  }
}
await api('PUT', '/stages/reorder', { query: { projectId: project.id }, body: { stageIds: ordered } });

console.log(`\n${stats.created} étape(s) créée(s), ${stats.updated} mise(s) à jour, ordre posé.`);
console.log(`${stats.instructions} campagne(s) ont reçu leurs consignes.`);
