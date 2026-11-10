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
const PROJECT = arg('project', 'Focus — Recette Sangha Télécom');
const DRY_RUN = process.argv.includes('--dry-run');

if (!BASE || !EMAIL || !PASSWORD) {
  console.error(
    'Usage : TCMS_PASSWORD=… node scripts/seed-path.mjs --url=https://… --email=…\n' +
      '  --project=<nom>   le projet à équiper (défaut : « Focus — Recette Sangha Télécom »)\n' +
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

Et cette fois, tu vas la construire. L'entreprise n'existe pas encore : tu l'inscris, tu la crées, tu nommes ses responsables, tu embauches ses salariés, tu signes leurs contrats, tu fais tourner un mois et tu sors une paie. Chaque étape est un cas de test, et chacune fabrique ce dont la suivante a besoin.

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
Certains cas des avenants sont déjà verts : ils ont été joués en octobre et novembre, et leurs verdicts tiennent. Ne les rejoue pas, sauf si quelque chose te semble faux — dans ce cas, rejoue et dis-le.
Un cas corrigé se rejoue dans sa situation d'origine ; il ne se déduit pas d'un correctif annoncé. Deux cas sont restés verts à tort comme ça, et ça a coûté deux semaines.

Si tu bloques, écris-nous. Un cas mal compris, un prérequis introuvable, un écran qui ne ressemble pas à ce qui est décrit : ce sont des informations utiles, pas des dérangements. Mieux vaut une question que dix cas cochés au hasard.`,
  },
  {
    title: 'Sangha Télécom, et les neuf personnes que tu vas incarner',
    content: `L'entreprise que tu construis s'appelle Sangha Télécom. Société anonyme, Brazzaville, secteur Technologie, convention collective NTIC. Elle comptera 52 collaborateurs à la fin de la quatrième étape.

Neuf personnes portent un rôle, et tu les joueras toutes :

Firmin Okemba — le PDG fondateur. C'est lui qui s'inscrit et crée l'entreprise.
Clarisse Mabiala — la Directrice Générale. Firmin la nomme administratrice.
Nadège Loubaki — la DRH. Clarisse l'invite. Nadège aura aussi sa propre fiche de salariée.
Gilda Nkouka — son assistante RH, avec des droits plus étroits.
Serge Ngoma — le chef comptable, qui fait la paie et ne touche pas aux fiches.
Ruth Bemba — la contrôleuse de gestion, qui ne doit pouvoir rien écrire du tout.
Armand Tchibota — le chef d'équipe Réseau, qui valide les absences de son équipe et d'elle seule.
Prisca Ondongo — la développeuse. C'est elle qui portera tout le contenu : contrat signé, bulletins, absences, documents.
Josué Makaya — le technicien embauché ce mois-ci. Lui ne portera rien, et c'est voulu : il sert à voir les écrans vides, ceux que personne ne regarde jamais.

Les 43 autres collaborateurs arrivent par un import, en une fois. Ils n'ont pas de contrat, et c'est normal : ils servent à éprouver les listes, les filtres et les compteurs sur un effectif réel.

Deux choses pratiques. Chaque personne se connecte avec sa propre adresse et reçoit son code par courriel : coche « Rester connecté » à chaque première connexion, et garde une fenêtre de navigateur par personne. Tu basculeras souvent, et ça t'économisera des heures.

Et les montants ne sont pas libres. La convention NTIC impose une grille de salaires, des primes de diplôme, une indemnité de transport et des majorations d'heures supplémentaires. Quand un cas annonce un montant, c'est celui du barème : s'il diffère à l'écran, c'est un défaut, même d'un franc.`,
  },
  {
    title: 'Le fil : la première étape, et c\'est la plus longue',
    content: `La première campagne s'appelle Le fil. Elle a 168 cas, et elle se joue strictement dans l'ordre, du premier au dernier. C'est elle qui fait exister l'entreprise ; tout le reste s'appuie dessus.

Elle commence par huit cas marqués « équipe technique » — ENV-01 à ENV-12. Ceux-là ne sont pas pour toi : ils demandent d'ouvrir la base, le serveur ou la configuration. On les joue de notre côté, et c'est nous qui les cochons. Préviens-nous avant de commencer : on ouvre cette partie ensemble.

Ensuite, dix actes, et ils sont tous pour toi :

Acte 1 — Firmin s'inscrit et crée Sangha Télécom.
Acte 2 — il nomme Clarisse administratrice.
Acte 3 — Clarisse recrute l'encadrement, chacun avec son rôle.
Acte 4 — Nadège peuple l'entreprise, 9 fiches à la main puis 43 par import.
Acte 5 — les contrats, et le barème de la convention qui s'impose.
Acte 6 — le premier mois tourne : absences, heures supplémentaires, clôture.
Acte 7 — la première paie.
Acte 8 — la vie continue : augmentations, départs, documents.
Acte 9 — la filiale, et les bascules entre entreprises.
Acte 10 — ce qui doit rester fermé, joué d'une traite à la fin.

Chaque acte dit ce qu'il faut faire si quelque chose casse. Lis ce paragraphe avant de commencer l'acte, pas après : si un maillon lâche, il y a un chemin de secours, et sans lui la suite est bloquée.

Un cas de cette campagne ne doit pas rester en Échoué sans commentaire. C'est la campagne dont tout le reste dépend : un défaut ici se propage partout.`,
  },
];

const WAVES = [
  {
    match: 'Vague 0',
    instructions: `Elle se joue dans l'ordre, du premier cas au dernier. C'est elle qui fait exister Sangha Télécom.

Les huit cas ENV sont du travail d'équipe : ne les coche pas seule, préviens-nous et on les ouvre ensemble.

Les dix actes qui suivent sont pour toi. Avant d'attaquer un acte, lis son paragraphe de repli : si un maillon casse, il y a un chemin de secours, et sans lui la suite est bloquée.

Un avertissement, et il concerne l'acte 2. Quand Firmin invitera Clarisse, elle n'aura pas encore de compte Focus — et on sait qu'un invité sans compte a déjà eu du mal à accepter son invitation. Si ça te bloque, mets Échoué, note le message exact que tu vois, et dis-le-nous tout de suite : il y a un contournement, mais il faut qu'on te le pose.`,
  },
  {
    match: 'Vague 1',
    instructions: `Prérequis : la vague 0 terminée.

Commence par les cas du plan 16 (identité et permissions), et dans le plan 16 par sa série 2 — l'invitation et le rattachement. C'est elle qui dit si le portail sait accueillir quelqu'un qui n'a pas de compte, et c'est la question qui décide du déroulé de toute la recette. Si tu as déjà buté là-dessus à l'acte 2, tu sauras pourquoi.

Puis le portail, puis l'onboarding. Le plan 16 fait autorité sur l'identité ; le jouer après les autres, c'est tout rejouer.

Les paragraphes §0 du plan 16 sont un préambule : à lire, pas à cocher. Mets-les en Ignoré.

Les cas GRD et DBL du portail sont les plus importants de la vague : ils touchent ce qui se passe juste après la connexion. Regarde-les deux fois.

L'onboarding ne se rejoue pas : il se joue dans le parcours de création de Sangha Télécom, celui de l'acte 1. Si tu l'as déjà traversé, reprends tes notes au lieu de recréer une entreprise — ça coûte un quart d'heure à chaque fois.`,
  },
  {
    match: 'Vague 2',
    instructions: `Prérequis : la vague 0 terminée — les 52 collaborateurs existent depuis l'acte 4.

Ne recrée pas les fiches : l'acte 4 les a faites. Cette vague creuse les écrans que l'acte 4 a seulement traversés — les filtres un par un, l'import dans tous ses états, et le cycle complet d'une invitation.

C'est le volume qui rend cette vague utile. La pagination, les filtres croisés et les cartes de statistiques ne se vérifient pas sur cinq lignes : ici il y en a 52, dont 43 sans contrat.

L'invitation et l'ouverture d'accès ont déjà été vues en vague 1. Si un cas te semble déjà joué là-bas, mets Ignoré et dis-le plutôt que de le rejouer.`,
  },
  {
    match: 'Vague 3',
    instructions: `Prérequis : les contrats signés à l'acte 5.

Les avenants sont presque finis : 56 cas sont déjà verts, joués en octobre et novembre, et leurs verdicts tiennent. Il te reste 17 cas — les prérequis, qui nomment maintenant Nadège et Prisca, et le cloisonnement, qui s'élargit parce qu'on a désormais Ruth, Gilda et Nadège la cumulante.

Garde la grille de la convention sous les yeux pour les contrats : les minimums s'opposent échelon par échelon, et quand le produit refuse un salaire trop bas, c'est le bon comportement — pas un défaut.

Les documents signés passent par un email avec un code : ouvre la boîte de contact, et regarde dans les spams.`,
  },
  {
    match: 'Vague 4',
    instructions: `Prérequis : le mois de l'acte 6 saisi et clôturé.

Tiens un carnet des nombres. Chaque compteur que tu relèves ici — taux de présence, heures, soldes — sera confronté à la paie en vague 5 et à l'espace salarié en vague 7. Un nombre noté une fois sert trois fois.

C'est le domaine où les compteurs mentent : le bandeau en haut d'écran et la grille en dessous ne sont pas deux vues de la même chose, et on les a déjà vus se contredire. Compte à la main dans la grille, puis compare au bandeau.

Deux repères pour les heures supplémentaires. Le seuil des cinq premières heures se compte sur la semaine, pas sur la journée. Et la nuit commence à 20 h : des heures de 19 h à 21 h font une heure de jour et une heure de nuit, à deux majorations différentes.`,
  },
  {
    match: 'Vague 5',
    instructions: `Prérequis : la paie de l'acte 7 sortie.

Commence par les réglages — charges, calendrier, compensations : la paie les consomme. Puis une session complète, de l'initialisation au bulletin.

Les cas de calcul se jouent avec le barème sous les yeux et une calculatrice. Vérifie le montant, pas seulement que l'écran s'affiche. C'est la vague la plus lente, et la plus utile.

Deux pièges à connaître. Il n'y aura pas 52 bulletins mais 8 : un par contrat finalisé. Et sur chaque bulletin, regarde la colonne « assiette » des cotisations : si elle affiche 0, tout le reste est faux même si ça a l'air normal.

Cinq écarts de calcul sont déjà connus et en attente de décision. Si tu en retrouves un, mets Échoué et commente quand même : c'est ce qui les fait trancher, et c'est le client qui signe les bulletins.`,
  },
  {
    match: 'Vague 6',
    instructions: `Indépendante des autres : elle ne demande ni contrat, ni paie, ni activité. Si quelqu'un te prête la main, c'est celle-là qu'il peut jouer en parallèle.

Attention aux cas de facturation certifiée : la mention « bac à sable » doit être visible à l'écran, et quand la plateforme est indisponible, l'envoi doit être fermé — pas silencieux.

Et la fiscalité congolaise n'accepte que trois taux de TVA : 18, 5 et 0 %. Si l'écran t'en laisse saisir un autre, c'est grave : une facture certifiée part à l'État avec cette valeur. Les centimes additionnels, eux, valent 5 % de la TVA — pas 5 % du montant hors taxes.`,
  },
  {
    match: 'Vague 7',
    instructions: `Prérequis : tout ce que les actes 4 à 8 ont fabriqué.

C'est le plus gros poste, mais il va vite : on vérifie ce qui est annoncé comme marchant, on ne découvre pas.

Deux cas t'attendent depuis longtemps. « Ouvrir Focus Pro » depuis l'espace salarié et « Passer à l'autre entreprise » n'avaient jamais pu être joués, faute de comptes. Nadège porte sa propre fiche depuis l'acte 4, Clarisse est sur les deux entités depuis l'acte 9 : les deux sont jouables maintenant.

Garde les permissions pour la fin et joue-les d'une traite : chaque cas demande de changer de compte. Grouper les bascules économise la moitié du temps.

Et pour chaque cas de permission, le verdict tient en trois points : le bouton est absent, l'adresse directe refuse, et l'API refuse. Un écran caché dont l'API répond n'est pas fermé — c'est juste un écran caché. Si tu ne peux pas vérifier le troisième point, dis-le, on le fait avec toi.`,
  },
  {
    match: 'En continu',
    instructions: `Ne consacre jamais une session à cette campagne. Elle se remplit en passant : chaque fois que tu croises un libellé en anglais, un écran vide sans explication, un affichage bizarre ou un NaN, note-le dans le cas qui correspond.

Ses cas d'accueil se jouent deux fois, et c'est voulu : une fois à l'acte 1, quand l'entreprise vient de naître et que tout est à zéro, puis une fois après la paie, quand elle est peuplée. Les deux passages ne montrent pas les mêmes défauts, et le premier n'avait jamais été possible.

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
