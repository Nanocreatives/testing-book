# testing-book — ce que ce fork ajoute à unittcms

Fork de [`kimatata/unittcms`](https://github.com/kimatata/unittcms) (GPL-3.0).
Un outil de **recette manuelle**, destiné aux personnes qui exécutent les tests
sans être développeuses et sans compte GitHub : elles y jouent les cas et y
cochent ce qu'elles ont vu.

L'outil n'est lié à aucun projet. **Sa première campagne est la recette de la
suite Focus**, et c'est elle qui a dicté les choix décrits ici — mais rien
n'empêche d'y importer les cas d'un autre produit : il suffit d'un fichier au
format de `scripts/import-focus-qa.mjs`.

**Ce fichier est séparé du `README.md` de l'amont exprès** — pour qu'une
synchronisation avec `kimatata/unittcms` ne produise pas de conflit.

## La règle qui gouverne tout

**Les plans de [`Nanocreatives/focus-qa`](https://github.com/Nanocreatives/focus-qa)
sont la source de vérité du TEXTE des cas. Cet outil est la source de vérité des
STATUTS.**

Conséquences, et elles ne sont pas négociables :

- On corrige l'énoncé d'un cas **dans `focus-qa/plans/*.md`**, jamais ici. Un
  énoncé modifié dans l'interface sera écrasé au prochain import.
- On coche un statut **ici**, jamais dans les plans. L'import **ne réécrit
  jamais** un statut déjà saisi.
- **La recette est manuelle.** Un cas n'est validé que **vu** — par la personne
  dans son navigateur, ou par Claude pilotant l'interface. Les tests Playwright
  des dépôts Focus disent ce que le code couvre ; ils ne cochent rien ici. Tous
  les cas sont importés en `automation-not-required`, et c'est voulu.

## Importer les cas

```bash
cd ../focus-qa && node scripts/export-cases.mjs
```

```bash
TCMS_PASSWORD=… node scripts/import.mjs --url=https://… --email=…
```

L'import passe par **l'API**, pas par le fichier SQLite : une instance déployée
vit dans un volume Docker sur un serveur distant, qu'aucun script local ne peut
ouvrir. C'est aussi ce qui permettra de déclencher un import depuis
l'application elle-même, sans accès au serveur.

Le mot de passe se lit dans l'environnement et n'apparaît jamais en argument :
une ligne de commande est visible de tout le système. En développement, le
backend sert ses routes à la racine — ajouter `--api-path=` (vide), car le
préfixe `/api` n'existe qu'en production, où `entrypoint.js` le monte.

**L'import est idempotent** : relancer met à jour les énoncés, crée ce qui
manque, et ne réécrit **jamais** un statut déjà saisi par un testeur. Vérifié
sur 1020 cas : second passage, 0 créé, 0 modifié, 1020 inchangés.

### Pourquoi un classeur Excel et non des créations unitaires

L'API limite à **1000 requêtes par heure et par IP**. Créer 1020 cas un par un
en demanderait plus de 1100 : l'import échouerait à mi-parcours, par
construction. La route d'import groupé prend un classeur par dossier et fait un
`bulkCreate` — une requête pour toute une section. On retombe sous les 250
requêtes.

### Deux pièges d'identité

**Les campagnes se créent avant les cas.** `GET /cases/byproject` exige un
`runId` existant : sans campagne en base, la relecture échoue, l'import ne voit
pas les cas déjà présents et les duplique à chaque relance.

**Un cas s'identifie par son dossier ET son titre**, jamais par le titre seul.
Des plans différents portent des identifiants identiques — `PRE-02` existe dans
le plan 05 et dans le plan 14. Avec une clé sur le seul titre, les deux n'en
font qu'un : ils s'écrasent mutuellement à chaque import, et leur rattachement
aux campagnes désigne le mauvais cas.

## Comment les 1020 cas sont rangés

| Dans focus-qa                   | Dans testing-book                                       |
| ------------------------------- | ------------------------------------------------------- |
| le projet entier                | **Project** « Focus — Recette finale »                  |
| un plan (`10-paie.md`)          | **Folder** de premier niveau, `10 — Paie · /hr/payroll` |
| une section (`CLC`)             | **Folder** imbriqué, `CLC — Le calcul`                  |
| un cas (`CLC-04`)               | **Case** `CLC-04 — IRPP — barème par tranches…`         |
| une vague de `docs/campagne.md` | **Run**, `Vague 5 — La paie`                            |
| le statut staging du cas        | **RunCase.status** dans la campagne de sa vague         |

**Les neuf campagnes portent l'ordre de jeu.** On ne joue pas la paie avant les
contrats : la vague 5 présuppose ce que la vague 3 a produit. L'ordre et son
pourquoi sont dans
[`focus-qa/docs/campagne.md`](https://github.com/Nanocreatives/focus-qa/blob/main/docs/campagne.md).

### Les correspondances d'entiers

`frontend/config/selection.ts` de l'amont définit ces énumérations par **l'ordre
de leurs tableaux** — l'index EST la valeur stockée. Les réordonner côté amont
casserait l'import en silence : relire ce fichier avant de toucher aux constantes
de `scripts/import-focus-qa.mjs`.

|              |                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Priorité** | `critical` si le cas porte 🔒 cloisonnement, 💱 calcul ou ⚠️ défaut connu ; sinon `high`/`medium`/`low` selon la priorité du plan |
| **Type**     | 🔒 → `security`, 💱 → `functional`, 📱 → `compatibility`, sinon `acceptance`                                                      |
| **Statut**   | ⬜ `untested` · 🟢 `passed` · 🔴 `failed` · 🟠 `retest` · ⚪ ⛔ `skipped`                                                         |

La priorité ne vient **pas** de celle du plan seule : la reporter telle quelle
mettait 980 cas sur 1020 en `critical`, et une priorité que presque tout porte ne
trie plus rien.

## Les trois rôles

L'amont en fournit trois, et ils suffisent :

|               |                                                                  |
| ------------- | ---------------------------------------------------------------- |
| **manager**   | voit tout, assigne, crée les campagnes — le pilote de la recette |
| **developer** | conçoit et corrige les cas — nous, quand un énoncé est faux      |
| **reporter**  | **exécute et coche** — la personne qui joue la recette           |

`RunCase` porte `assigneeUserId` : c'est ce qui répond à « qui fait, qui ne fait
pas ».

## Ce qu'il a fallu corriger dans l'amont

**`GET /home/:projectId` tuait le serveur.** La route chargeait le projet avec
deux branches `hasMany` dans **une seule** requête — `Folders → Cases` et
`Runs → RunCases`. Sequelize en fait un produit cartésien : sur 1020 cas et neuf
campagnes, c'est le million de lignes, chacune portant le texte complet du cas.
Le processus mourait sur « JavaScript heap out of memory » après plus de 60
secondes, sans jamais répondre — et la page d'accueil du projet est la première
que voit un testeur.

Corrigé dans `backend/routes/home/index.js` : deux requêtes séparées, et
seulement les colonnes que la page agrège vraiment (`type`, `priority`,
`status`, `createdAt`). **De 60 s et un plantage à 29 ms et 76 Ko.** La forme
JSON est inchangée, donc rien à toucher côté frontend.

C'est un défaut de l'amont, pas de notre import. **Remonté et corrigé chez eux :
[kimatata/unittcms#466](https://github.com/kimatata/unittcms/pull/466)**, avec un
test de non-régression qui échoue sur l'implémentation d'origine. Le fichier et
son test sont **en anglais dans ce dépôt aussi** — garder une version française
ici rouvrirait le conflit à chaque synchronisation avec l'amont.

## Deux pièges rencontrés en important

**Les dates.** Le dialecte SQLite de Sequelize écrit `YYYY-MM-DD HH:MM:SS.SSS
+00:00` et **ne sait pas relire un ISO 8601** avec « T » et « Z » : il rend
`null` sans la moindre erreur. Un `createdAt` nul casse le graphique de
progression, qui construit ses catégories à partir des dates. L'importeur écrit
désormais le bon format.

**Les dossiers.** Un plan sans sections (00, 02, 07, 08) recevait un
sous-dossier portant **le nom exact de son parent** — et le tableau d'une
campagne ne montre que les cas placés _directement_ dans le dossier
sélectionné : les cas devenaient invisibles. Ces plans rangent maintenant leurs
cas dans le dossier du plan.

## Déployer

Un seul conteneur, un volume, aucune URL absolue dans le code — le frontend
appelle l'API en `/api`, même origine. **Changer de nom de domaine ne demande
donc ni rebuild ni migration.**

### Sur Coolify

1. Nouvelle ressource → **Docker Compose**, source = ce dépôt, branche `main`.
   Le `docker-compose.yaml` est à la racine, rien à adapter.
2. Variables : **`SECRET_KEY`** et `FRONTEND_ORIGIN=https://<ton-sous-domaine>`.
   Générer la clé avec `openssl rand -base64 48`, et **ne la coller nulle part
   ailleurs** — c'est elle qui signe les jetons de session.

   Le compose de l'amont écrivait `SECRET_KEY=your_secret_key_here` **en
   valeur littérale** : toute clé posée par l'hôte était silencieusement
   ignorée, et l'instance signait ses jetons avec une chaîne publiée dans un
   dépôt public. Ici la variable est obligatoire — sans elle, **le déploiement
   échoue au lieu de démarrer une instance ouverte à la forge de jetons**.

3. Vérifier que les deux volumes **`db-data`** et **`uploads-data`** sont bien
   persistants : la base, et les pièces jointes.

   L'amont montait les pièces jointes par un **bind mount sur le dépôt cloné**.
   Sur une plateforme qui reclone à chaque déploiement, le dossier revient vide
   — et une capture d'écran jointe à un constat, c'est la preuve du défaut.
   C'est un volume nommé ici.

4. Port exposé : **8000**.

### Le nom de domaine, gratuitement

Un compte **[DuckDNS](https://www.duckdns.org)** donne cinq sous-domaines
`*.duckdns.org`. On en crée un, on le pointe sur l'IP du serveur Coolify, et on
le déclare comme domaine du service.

**HTTPS fonctionne** : pour un hôte unique, Traefik obtient son certificat par
la validation HTTP-01, qui sert un fichier sur le port 80 — il suffit que ce
port soit ouvert. Aucune configuration DNS supplémentaire n'est nécessaire ; la
validation DNS-01 ne sert que pour un certificat _wildcard_.

⚠️ **Ne pas utiliser le domaine `sslip.io` que Coolify génère par défaut.** Il
fonctionne, mais **reste en HTTP** : Let's Encrypt limite le débit sur la zone
`sslip.io` partagée et la délivrance échoue. Or la première chose que fait un
testeur sur cet outil, c'est taper un mot de passe.

## Développer localement

Le build natif de `sqlite3@5` **échoue avec Node 22** (node-gyp 8). L'image
Docker utilise Node 20, où il passe. En local sur Node 22 :

```bash
cd backend && npm install --no-save sqlite3@latest && npx sequelize-cli db:migrate
```

`--no-save` est délibéré : ne pas faire diverger le `package.json` de l'amont
pour un contournement de poste de travail.

## Ce qui reste à faire

Par ordre de valeur, et aucun n'est nécessaire pour commencer à jouer la recette :

1. **Rattacher un dépôt et choisir une branche** — un formulaire, l'API GitHub,
   et le SHA déployé enregistré sur la campagne. Aujourd'hui l'information vit
   dans la description de la campagne, à la main.
2. **Un bouton « générer »** qui appelle Claude avec le dépôt en contexte plutôt
   que d'embarquer un modèle. La génération n'est pas à réimplémenter : c'est ce
   qui a produit les 1020 cas.
3. **Les métriques de testeurs** — cas assignés, joués, délai moyen, abandons.
   C'est la seule de ces trois choses qu'aucun outil existant ne vend, et celle
   qu'il faut coder **après** une campagne jouée : on ne sait pas encore quelles
   mesures valent la peine.
