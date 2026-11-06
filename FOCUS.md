# focus-tcms — ce que ce fork ajoute à unittcms

Fork de [`kimatata/unittcms`](https://github.com/kimatata/unittcms) (GPL-3.0),
déployé pour la **recette manuelle de la suite Focus**. Il sert à une personne
qui n'est pas développeuse et qui n'a pas de compte GitHub : elle y joue les cas
et y coche ce qu'elle a vu.

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
node scripts/import-focus-qa.mjs --owner-email=<compte existant de focus-tcms>
```

L'import est **idempotent** : relancer met à jour les énoncés, les priorités et
les types, crée ce qui manque, et laisse les statuts intacts. Il n'écrit aucun
compte — le propriétaire doit déjà exister, créé par l'inscription normale de
l'application. `--dry-run` montre ce qui serait fait.

## Comment les 1020 cas sont rangés

| Dans focus-qa | Dans focus-tcms |
|---|---|
| le projet entier | **Project** « Focus — Recette finale » |
| un plan (`10-paie.md`) | **Folder** de premier niveau, `10 — Paie · /hr/payroll` |
| une section (`CLC`) | **Folder** imbriqué, `CLC — Le calcul` |
| un cas (`CLC-04`) | **Case** `CLC-04 — IRPP — barème par tranches…` |
| une vague de `docs/campagne.md` | **Run**, `Vague 5 — La paie` |
| le statut staging du cas | **RunCase.status** dans la campagne de sa vague |

**Les neuf campagnes portent l'ordre de jeu.** On ne joue pas la paie avant les
contrats : la vague 5 présuppose ce que la vague 3 a produit. L'ordre et son
pourquoi sont dans
[`focus-qa/docs/campagne.md`](https://github.com/Nanocreatives/focus-qa/blob/main/docs/campagne.md).

### Les correspondances d'entiers

`frontend/config/selection.ts` de l'amont définit ces énumérations par **l'ordre
de leurs tableaux** — l'index EST la valeur stockée. Les réordonner côté amont
casserait l'import en silence : relire ce fichier avant de toucher aux constantes
de `scripts/import-focus-qa.mjs`.

| | |
|---|---|
| **Priorité** | `critical` si le cas porte 🔒 cloisonnement, 💱 calcul ou ⚠️ défaut connu ; sinon `high`/`medium`/`low` selon la priorité du plan |
| **Type** | 🔒 → `security`, 💱 → `functional`, 📱 → `compatibility`, sinon `acceptance` |
| **Statut** | ⬜ `untested` · 🟢 `passed` · 🔴 `failed` · 🟠 `retest` · ⚪ ⛔ `skipped` |

La priorité ne vient **pas** de celle du plan seule : la reporter telle quelle
mettait 980 cas sur 1020 en `critical`, et une priorité que presque tout porte ne
trie plus rien.

## Les trois rôles

L'amont en fournit trois, et ils suffisent :

| | |
|---|---|
| **manager** | voit tout, assigne, crée les campagnes — le pilote de la recette |
| **developer** | conçoit et corrige les cas — nous, quand un énoncé est faux |
| **reporter** | **exécute et coche** — la personne qui joue la recette |

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

C'est un défaut de l'amont, pas de notre import : il mérite d'être remonté à
[`kimatata/unittcms`](https://github.com/kimatata/unittcms).

## Deux pièges rencontrés en important

**Les dates.** Le dialecte SQLite de Sequelize écrit `YYYY-MM-DD HH:MM:SS.SSS
+00:00` et **ne sait pas relire un ISO 8601** avec « T » et « Z » : il rend
`null` sans la moindre erreur. Un `createdAt` nul casse le graphique de
progression, qui construit ses catégories à partir des dates. L'importeur écrit
désormais le bon format.

**Les dossiers.** Un plan sans sections (00, 02, 07, 08) recevait un
sous-dossier portant **le nom exact de son parent** — et le tableau d'une
campagne ne montre que les cas placés *directement* dans le dossier
sélectionné : les cas devenaient invisibles. Ces plans rangent maintenant leurs
cas dans le dossier du plan.

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
