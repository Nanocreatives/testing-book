import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineTag from '../../models/tags.js';
import defineCaseTag from '../../models/caseTags.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

// `POST /casetags/update` attache les étiquettes d'UN cas, et remplace tout son
// jeu. Une synchronisation qui ne possède qu'une partie du vocabulaire a besoin
// de l'inverse : beaucoup de cas d'un coup, et seulement les étiquettes nommées.
export const MAX_TAGS_PER_CASE = 5;

/**
 * Ce qu'il faut écrire pour amener chaque cas au jeu voulu.
 *
 * Un cas dont le jeu dépasserait la limite n'est pas tronqué mais écarté
 * entier : l'éditeur refuserait ensuite d'enregistrer, et le cas perdrait en
 * silence des étiquettes qu'une personne a posées.
 */
export function planCaseTags({ caseIds, current, addTagIds = [], removeTagIds = [], maxTags = MAX_TAGS_PER_CASE }) {
  const toAdd = [...new Set(addTagIds)];
  const toRemove = new Set(removeTagIds);
  const links = [];
  const unlinks = [];
  const skipped = [];

  for (const caseId of caseIds) {
    const held = new Set(current.get(caseId) ?? []);
    const wanted = new Set([...held].filter((tagId) => !toRemove.has(tagId)));
    for (const tagId of toAdd) {
      wanted.add(tagId);
    }

    if (wanted.size > maxTags) {
      skipped.push(caseId);
      continue;
    }

    for (const tagId of wanted) {
      if (!held.has(tagId)) {
        links.push({ caseId, tagId });
      }
    }
    for (const tagId of held) {
      if (!wanted.has(tagId)) {
        unlinks.push({ caseId, tagId });
      }
    }
  }

  return { links, unlinks, skipped };
}

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromProjectId } = editableMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Tag = defineTag(sequelize, DataTypes);
  const CaseTag = defineCaseTag(sequelize, DataTypes);

  router.put('/tags', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const projectId = req.query.projectId;
      const { caseIds, addTagIds = [], removeTagIds = [] } = req.body;

      if (!Array.isArray(caseIds) || caseIds.length === 0) {
        return res.status(400).json({ error: 'caseIds must be a non-empty array' });
      }
      if (!Array.isArray(addTagIds) || !Array.isArray(removeTagIds)) {
        return res.status(400).json({ error: 'addTagIds and removeTagIds must be arrays' });
      }

      // Les cas et les étiquettes sont désignés par identifiant seul : sans ces
      // deux vérifications, un développeur étiquetterait les cas d'un autre
      // projet, ou y collerait l'étiquette d'un projet voisin.
      const folders = await Folder.findAll({ where: { projectId: projectId }, attributes: ['id'] });
      const folderIds = folders.map((folder) => folder.id);

      const named = [...new Set([...addTagIds, ...removeTagIds])];
      if (named.length > 0) {
        const owned = await Tag.findAll({
          where: { id: { [Op.in]: named }, projectId: projectId },
          attributes: ['id'],
        });
        if (owned.length !== named.length) {
          return res.status(400).json({ error: 'every tag must belong to this project' });
        }
      }

      const cases = await Case.findAll({
        where: { id: { [Op.in]: caseIds }, folderId: { [Op.in]: folderIds } },
        attributes: ['id'],
      });
      const ownedCaseIds = cases.map((testCase) => testCase.id);

      const held = await CaseTag.findAll({ where: { caseId: { [Op.in]: ownedCaseIds } } });
      const current = new Map();
      for (const link of held) {
        current.set(link.caseId, [...(current.get(link.caseId) ?? []), link.tagId]);
      }

      const { links, unlinks, skipped } = planCaseTags({
        caseIds: ownedCaseIds,
        current,
        addTagIds,
        removeTagIds,
      });

      if (links.length > 0) {
        await CaseTag.bulkCreate(links);
      }
      for (const { caseId, tagId } of unlinks) {
        await CaseTag.destroy({ where: { caseId, tagId } });
      }

      res.json({ added: links.length, removed: unlinks.length, skipped: skipped.length });
    } catch (error) {
      console.error('Error updating case tags:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
