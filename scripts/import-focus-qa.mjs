#!/usr/bin/env node
// Importe les cas de recette de `focus-qa` dans la base de focus-tcms.
//
//   node scripts/import-focus-qa.mjs --owner-email=toi@exemple.com
//
// Les plans de `focus-qa` restent la source de vérité du TEXTE des cas ; cet
// outil devient la source des STATUTS. Relancer l'import met donc à jour les
// énoncés sans toucher aux statuts déjà saisis par les testeurs.
//
// L'import n'écrit AUCUN compte : les utilisateurs se créent par l'inscription
// normale de l'application, et `--owner-email` désigne celui qui portera le
// projet. Cette direction de dépendance évite d'avoir à manipuler des mots de
// passe ici.
//
// Écrit en SQL direct via `node:sqlite` plutôt qu'à travers les modèles de
// l'app : pas de build TypeScript ni de node_modules à charger pour un import.

import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const CASES_JSON = resolve(
  arg('cases', new URL('../../focus-qa/out/cases.json', import.meta.url).pathname)
)
const DB_PATH = resolve(arg('db', new URL('../backend/database/database.sqlite', import.meta.url).pathname))
const OWNER_EMAIL = arg('owner-email')
const DRY_RUN = process.argv.includes('--dry-run')

if (!OWNER_EMAIL) {
  console.error('Il manque --owner-email=<adresse d\'un compte existant de focus-tcms>.')
  process.exit(1)
}

// --- Les entiers de focus-tcms -----------------------------------------------
// L'index du tableau dans `frontend/config/selection.ts` EST la valeur stockée.
// Les renommer côté app casserait ces correspondances : les relire là-bas avant
// de toucher à ce bloc.

// 0 critical · 1 high · 2 medium · 3 low
//
// La priorité du PLAN dit l'importance d'un domaine, pas celle d'un cas : la
// reporter telle quelle mettait 980 cas sur 1020 en « critical », et une
// priorité que presque tout porte ne trie plus rien. Ce sont les marqueurs du
// cas qui discriminent.
const PRIORITY_PAR_PLAN = { P0: 1 /* high */, P1: 2 /* medium */, P2: 3 /* low */ }
const PRIORITY_CRITICAL = 0

/** Les marqueurs qui font d'un cas un cas qu'on ne saute pas. */
const MARQUEURS_CRITIQUES = ['securite', 'calcul', 'attention']

const TYPE = {
  securite: 1 /* security */,
  calcul: 4 /* functional */,
  responsive: 8 /* compatibility */,
  pdf: 5 /* acceptance */,
  email: 5 /* acceptance */,
}
const TYPE_DEFAUT = 5 // acceptance — c'est une recette d'acceptation

// `automation-not-required` : la recette est manuelle et le reste. Ce n'est pas
// « impossible à automatiser », c'est « on ne cherche pas à l'automatiser ».
const AUTOMATION_NOT_REQUIRED = 1
const TEMPLATE_TEXT = 0
const STATE_DEFAUT = 0

/** ⬜ untested · 🟢 passed · 🔴 failed · 🟠 retest · ⚪ ⛔ skipped */
const RUN_CASE_STATUS = { '⬜': 0, '🟢': 1, '🔴': 2, '🟠': 3, '⚪': 4, '⛔': 4 }

const RUN_STATE = { nouveau: 0, enCours: 1 }
const MEMBER_ROLE = { manager: 0, developer: 1, reporter: 2 }

const WAVE_TITLES = {
  0: 'Vague 0 — Rendre l\'environnement testable',
  1: 'Vague 1 — Le portail et l\'identité',
  2: 'Vague 2 — Le registre',
  3: 'Vague 3 — Les contrats',
  4: 'Vague 4 — L\'activité',
  5: 'Vague 5 — La paie',
  6: 'Vague 6 — Les ventes',
  7: 'Vague 7 — L\'autre côté, et le cloisonnement',
}
const WAVE_CONTINU = 'En continu — transverse'

// --- Lecture -----------------------------------------------------------------

const payload = JSON.parse(readFileSync(CASES_JSON, 'utf-8'))
const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = ON')

/**
 * Le dialecte SQLite de Sequelize écrit ses dates en
 * `YYYY-MM-DD HH:MM:SS.SSS +00:00`, et ne sait PAS relire un ISO 8601 avec
 * « T » et « Z » : il rend `null` sans erreur. Un `createdAt` nul casse le
 * graphique de progression de la page d'accueil, qui construit ses catégories
 * à partir des dates.
 */
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00')
const one = (sql, ...p) => db.prepare(sql).get(...p)
const run = (sql, ...p) => db.prepare(sql).run(...p)

const owner = one('SELECT id, username FROM users WHERE email = ?', OWNER_EMAIL)
if (!owner) {
  console.error(
    `Aucun compte focus-tcms pour « ${OWNER_EMAIL} ».\n` +
      'Crée-le par l\'inscription de l\'application, puis relance.'
  )
  process.exit(1)
}

const typeOf = (markers) => {
  for (const m of ['securite', 'calcul', 'responsive', 'pdf', 'email']) {
    if (markers.includes(m)) return TYPE[m]
  }
  return TYPE_DEFAUT
}

/**
 * Critique = cloisonnement, calcul, ou défaut déjà connu. Les deux premiers
 * parce que « le calcul de paie et le cloisonnement n'ont pas de P2 »
 * (focus-qa/docs/conventions.md) ; le troisième parce qu'un cas qui porte ⚠️
 * vérifie un défaut documenté ou une décision en attente — c'est précisément
 * celui qu'il ne faut pas remettre à plus tard.
 */
const priorityOf = (c) =>
  c.markers.some((m) => MARQUEURS_CRITIQUES.includes(m))
    ? PRIORITY_CRITICAL
    : (PRIORITY_PAR_PLAN[c.priority] ?? PRIORITY_PAR_PLAN.P1)

/** L'énoncé complet, débarrassé du balisage que l'outil n'affiche pas. */
const plainText = (md) =>
  md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// --- Écriture ----------------------------------------------------------------

const stats = { folders: 0, cases: 0, updated: 0, runs: 0, runCases: 0, kept: 0 }

const upsertFolder = (name, detail, parentFolderId, projectId) => {
  const found = parentFolderId
    ? one('SELECT id FROM folders WHERE name = ? AND parentFolderId = ?', name, parentFolderId)
    : one(
        'SELECT id FROM folders WHERE name = ? AND projectId = ? AND parentFolderId IS NULL',
        name,
        projectId
      )
  if (found) return found.id
  const t = now()
  run(
    'INSERT INTO folders (name, detail, parentFolderId, projectId, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
    name,
    detail,
    parentFolderId,
    projectId,
    t,
    t
  )
  stats.folders += 1
  return one('SELECT last_insert_rowid() AS id').id
}

if (DRY_RUN) {
  console.log(`À blanc — ${payload.cases.length} cas, ${payload.plans.length} plans.`)
  console.log(`Propriétaire : ${owner.username} (#${owner.id}).`)
  process.exit(0)
}

db.exec('BEGIN')
try {
  // Projet
  let project = one('SELECT id FROM projects WHERE name = ?', payload.project.name)
  if (!project) {
    const t = now()
    run(
      'INSERT INTO projects (name, detail, isPublic, userId, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
      payload.project.name,
      payload.project.detail,
      0,
      owner.id,
      t,
      t
    )
    project = one('SELECT last_insert_rowid() AS id')
  } else {
    run('UPDATE projects SET detail = ?, updatedAt = ? WHERE id = ?', payload.project.detail, now(), project.id)
  }

  if (!one('SELECT id FROM members WHERE userId = ? AND projectId = ?', owner.id, project.id)) {
    const t = now()
    run(
      'INSERT INTO members (userId, projectId, role, createdAt, updatedAt) VALUES (?,?,?,?,?)',
      owner.id,
      project.id,
      MEMBER_ROLE.manager,
      t,
      t
    )
  }

  // Dossiers : un par plan, un sous-dossier par section
  const planFolder = new Map()
  const sectionFolder = new Map()
  for (const p of payload.plans) {
    const detail =
      `${p.domaine} · ${p.priorite} · ${p.cases} cas · ` +
      (p.wave === null ? 'en continu' : `vague ${p.wave}`) +
      ` · dépôts : ${p.depots} · source : plans/${p.file}`
    planFolder.set(p.plan, upsertFolder(`${p.plan} — ${p.title}`, detail.slice(0, 480), null, project.id))
  }

  // Cas
  const caseIdByRef = new Map()
  for (const c of payload.cases) {
    const parent = planFolder.get(c.plan)
    const key = `${c.plan}/${c.section}`
    // Un plan sans sections (l'exportateur met alors `section` = numéro du plan)
    // n'a pas de sous-dossier : en créer un redonnerait au dossier enfant le nom
    // exact de son parent, et les cas disparaîtraient du tableau d'une campagne,
    // qui ne montre que les cas DIRECTEMENT dans le dossier sélectionné.
    if (!sectionFolder.has(key)) {
      sectionFolder.set(
        key,
        c.section === c.plan
          ? parent
          : upsertFolder(`${c.section} — ${c.sectionTitle}`.slice(0, 200), null, parent, project.id)
      )
    }
    const folderId = sectionFolder.get(key)
    const title = `${c.ref} — ${c.title}`.slice(0, 250)
    const description = plainText(c.statement).slice(0, 2000)
    const pre = plainText(c.preConditions).slice(0, 1000) || null
    const exp = plainText(c.expectedResults).slice(0, 1000) || null

    const existing = one('SELECT id FROM cases WHERE folderId = ? AND title LIKE ?', folderId, `${c.ref} — %`)
    if (existing) {
      run(
        'UPDATE cases SET title=?, description=?, priority=?, type=?, preConditions=?, expectedResults=?, updatedAt=? WHERE id=?',
        title,
        description,
        priorityOf(c),
        typeOf(c.markers),
        pre,
        exp,
        now(),
        existing.id
      )
      stats.updated += 1
      caseIdByRef.set(`${c.plan}/${c.ref}`, existing.id)
      continue
    }
    const t = now()
    run(
      'INSERT INTO cases (folderId, title, state, priority, type, automationStatus, description, template, preConditions, expectedResults, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      folderId,
      title,
      STATE_DEFAUT,
      priorityOf(c),
      typeOf(c.markers),
      AUTOMATION_NOT_REQUIRED,
      description,
      TEMPLATE_TEXT,
      pre,
      exp,
      t,
      t
    )
    stats.cases += 1
    caseIdByRef.set(`${c.plan}/${c.ref}`, one('SELECT last_insert_rowid() AS id').id)
  }

  // Campagnes : une par vague, dans l'ordre de docs/campagne.md
  const waves = [...new Set(payload.cases.map((c) => c.wave))].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a - b
  )
  for (const wave of waves) {
    const name = wave === null ? WAVE_CONTINU : WAVE_TITLES[wave]
    const members = payload.cases.filter((c) => c.wave === wave)
    const plans = [...new Set(members.map((c) => c.plan))].sort()
    let r = one('SELECT id FROM runs WHERE name = ? AND projectId = ?', name, project.id)
    if (!r) {
      const t = now()
      run(
        'INSERT INTO runs (name, configurations, description, state, projectId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
        name,
        'staging',
        `Plans ${plans.join(', ')} · ${members.length} cas · recette manuelle, un cas n'est validé que VU.`,
        wave === null ? RUN_STATE.enCours : RUN_STATE.nouveau,
        project.id,
        t,
        t
      )
      r = one('SELECT last_insert_rowid() AS id')
      stats.runs += 1
    }
    for (const c of members) {
      const caseId = caseIdByRef.get(`${c.plan}/${c.ref}`)
      const existing = one('SELECT id, status FROM runCases WHERE runId = ? AND caseId = ?', r.id, caseId)
      if (existing) {
        // Un statut déjà saisi dans l'outil fait foi : c'est lui la vérité des
        // statuts. On ne le réécrit jamais depuis les plans.
        stats.kept += 1
        continue
      }
      const t = now()
      run(
        'INSERT INTO runCases (runId, caseId, status, assigneeUserId, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
        r.id,
        caseId,
        RUN_CASE_STATUS[c.staging.mark] ?? 0,
        null,
        t,
        t
      )
      stats.runCases += 1
    }
  }

  db.exec('COMMIT')
} catch (err) {
  db.exec('ROLLBACK')
  console.error('Import annulé, rien n\'a été écrit :', err.message)
  process.exit(1)
}

const counts = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM folders) AS folders,
            (SELECT COUNT(*) FROM cases) AS cases,
            (SELECT COUNT(*) FROM runs) AS runs,
            (SELECT COUNT(*) FROM runCases) AS runCases`
  )
  .get()

console.log(`Import terminé dans ${DB_PATH}`)
console.log(`  dossiers créés    ${stats.folders}`)
console.log(`  cas créés         ${stats.cases}`)
console.log(`  cas mis à jour    ${stats.updated}`)
console.log(`  campagnes créées  ${stats.runs}`)
console.log(`  cas rattachés     ${stats.runCases}`)
console.log(`  statuts conservés ${stats.kept}`)
console.log(`\nEn base : ${counts.folders} dossiers · ${counts.cases} cas · ${counts.runs} campagnes · ${counts.runCases} rattachements`)
