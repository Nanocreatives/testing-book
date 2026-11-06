# AGENTS.md — travailler dans ce dépôt

Ce dépôt est un **fork de [`kimatata/unittcms`](https://github.com/kimatata/unittcms)** (GPL-3.0).
Travailler ici, c'est travailler dans le code de quelqu'un d'autre. Tout ce qui
suit en découle.

**À lire avant d'écrire la première ligne, à chaque tâche.**

## La question qui précède tout

Avant de toucher au moindre fichier :

> **Ce changement est-il utile à tout le monde, ou seulement à nous ?**

La réponse décide de la branche de départ, et une erreur ici ne se rattrape pas
proprement.

|                                        | Utile à tout le monde                                                                         | Spécifique à nous                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Quoi**                               | un défaut de l'amont, une fonctionnalité générique, une langue, une correction de performance | l'importeur, le `docker-compose`, `FORK.md`, ce fichier, tout ce qui parle de Focus |
| **Branche de départ**                  | **`upstream/develop`**                                                                        | **`funnel`**                                                                        |
| **Destination**                        | PR vers `kimatata/unittcms:develop`, **puis** merge dans `funnel`                             | merge dans `funnel`, et rien d'autre                                                |
| **Langue du code et des commentaires** | **anglais**                                                                                   | français                                                                            |

**Une contribution ne part jamais de `funnel`.** `funnel` porte notre
divergence : une PR issue de là leur proposerait notre importeur, notre compose
et notre documentation. Ils refuseraient, et ils auraient raison.

```bash
# Utile à tout le monde
git checkout -b fix/<sujet> upstream/develop
# … puis PR vers kimatata, puis :
git checkout funnel && git merge --no-ff fix/<sujet>
```

```bash
# Spécifique à nous
git checkout -b feat/<sujet> funnel
git checkout funnel && git merge --no-ff feat/<sujet>
```

Une seule implémentation, deux destinations : on n'attend pas leur revue pour en
profiter, et le jour où ils mergent, la synchronisation est un non-événement.

### Les cas limites

- **Un correctif chez nous qui révèle un bug chez eux** → deux changements
  distincts. Le correctif générique part sur `upstream/develop` ; notre
  adaptation reste sur `funnel`.
- **Une fonctionnalité qui nous est utile et leur serait utile** → elle part à
  l'amont. Le doute profite à la contribution : au pire ils refusent, et on la
  garde sur `funnel`.
- **Du code qui mentionne Focus, un client, ou une de nos URL** → jamais à
  l'amont, sans discussion.

## Les règles de l'amont

Elles sont dans leur [`CONTRIBUTING.md`](CONTRIBUTING.md) et ne se négocient
pas :

- **`main` est un instantané de leur production.** Tout le développement passe
  par des branches dédiées et se merge dans **`develop`**. Une PR qui cible
  `main` sera refusée.
- **Ouvrir une issue d'abord** pour une fonctionnalité ou un changement
  significatif. Un correctif de bug peut partir directement en PR.
- **Garder les PR petites et ciblées.** Plusieurs PR à la fois, ou une PR large,
  allongent la revue.
- **Des tests** là où c'est applicable (Vitest ou Playwright).
- **Des captures ou une courte vidéo** pour tout changement d'interface.
- **La CI doit passer** : formatage et tests.

## Avant toute PR vers l'amont

Dans cet ordre, et sans en sauter :

```bash
npx vitest run
```

```bash
npx prettier --check <fichiers touchés> && npx eslint <fichiers touchés>
```

```bash
cd frontend && npx tsc --noEmit
```

**`tsc` rend des erreurs préexistantes sur `develop`.** Les compter avant et
après : le nombre doit être **identique**. Annoncer ce chiffre dans la PR vaut
mieux que de prétendre que tout est propre.

```bash
git diff --stat upstream/develop...HEAD
```

Relire ce diff ligne à ligne. **Si un seul fichier n'appartient pas au sujet de
la PR, il ne part pas.** `package-lock.json` modifié par un `npm install` de
confort en fait partie.

## Les pièges de ce code, vérifiés

Chacun a déjà coûté du temps. Les relire avant de toucher aux zones concernées.

**Les énumérations sont des index.** `frontend/config/selection.ts` définit
priorités, types, statuts et rôles par **l'ordre de leurs tableaux** : l'index
EST la valeur stockée en base. Réordonner un tableau casse les données
existantes **en silence**. La route d'import groupé, elle, attend les noms.

**Le dialecte SQLite de Sequelize** écrit ses dates en
`YYYY-MM-DD HH:MM:SS.SSS +00:00` et **ne sait pas relire un ISO 8601** avec
« T » et « Z » : il rend `null` sans erreur.

**Deux branches `hasMany` dans une même requête** produisent un produit
cartésien. C'était le défaut de `GET /home/:projectId` — corrigé par la PR #466.
Le motif se reproduira ailleurs.

**L'API limite à 1000 requêtes par heure et par IP.** Toute écriture en masse
doit passer par une route groupée, sinon elle échoue à mi-parcours.

**Un cas de test s'identifie par son dossier ET son titre.** Jamais par le titre
seul : des dossiers différents portent légitimement des titres identiques.

**`GET /cases/byproject` exige un `runId` existant.** Créer les campagnes avant
les cas.

**Ajouter un membre ne cherche que parmi les comptes existants.** Il n'y a pas
de parcours d'invitation : la personne s'inscrit, puis on l'ajoute.

## Les branches

|           |                                                                               |
| --------- | ----------------------------------------------------------------------------- |
| `main`    | miroir de leur production. **Ne jamais y committer.**                         |
| `develop` | miroir de leur intégration. **Ne jamais y committer** — c'est la base des PR. |
| `funnel`  | **branche par défaut**, ce qui est déployé, et la base de nos features.       |

Les deux copies du dépôt n'ont pas le même rôle : **`Saintrick-FM/testing-book`
est la référence** et porte les branches des PR vers l'amont ;
`Nanocreatives/testing-book` sert au déploiement.

## Synchroniser avec l'amont

```bash
git fetch upstream
git checkout develop && git merge --ff-only upstream/develop && git push origin develop
git checkout funnel && git merge --no-ff upstream/develop
```

Si une de nos PR a été mergée chez eux, le merge dans `funnel` est un
non-événement : le contenu y est déjà, à l'identique. **C'est pour ça que le
code destiné à l'amont reste commenté en anglais des deux côtés** — une version
française rouvrirait le conflit à chaque synchronisation.

## Ce qui ne se fait pas

- Committer sur `main` ou `develop`.
- Ouvrir une PR vers l'amont depuis `funnel`.
- Faire diverger `package.json` pour un contournement de poste de travail —
  `npm install --no-save` existe.
- Écrire un secret dans un fichier suivi. `docker-compose.yaml` exige
  `SECRET_KEY` par l'environnement, et échoue sans lui plutôt que de démarrer
  avec la valeur d'exemple de l'amont, qui est publique.
- Modifier le `README.md` de l'amont. Notre documentation vit dans `FORK.md`,
  séparée exprès pour qu'une synchronisation ne produise pas de conflit.
