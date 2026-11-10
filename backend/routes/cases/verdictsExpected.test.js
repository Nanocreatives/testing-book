import { describe, it, expect, beforeEach } from 'vitest';
import { Sequelize, DataTypes } from 'sequelize';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineProject from '../../models/projects.js';

// La route elle-même est un mince emballage autour de cet UPDATE : ce qui mérite
// d'être éprouvé, c'est qu'il ne franchit pas la frontière du projet. Les cas
// sont adressés par leur seul identifiant, et sans la jointure aux dossiers un
// développeur requalifierait les cas d'un autre projet.
let sequelize;
let Case;
let Folder;

beforeEach(async () => {
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  defineProject(sequelize, DataTypes);
  Folder = defineFolder(sequelize, DataTypes);
  Case = defineCase(sequelize, DataTypes);
  await sequelize.sync();
  await sequelize.query('PRAGMA foreign_keys = OFF');
});

const addCase = (folderId, title) =>
  Case.create({ title, state: 0, priority: 1, type: 0, automationStatus: 0, template: 0, folderId });

const updateExpected = async (caseIds, verdictsExpected, projectId) => {
  const folders = await Folder.findAll({ where: { projectId }, attributes: ['id'] });
  const [updated] = await Case.update(
    { verdictsExpected },
    {
      where: {
        id: { [Sequelize.Op.in]: caseIds },
        folderId: { [Sequelize.Op.in]: folders.map((folder) => folder.id) },
      },
    }
  );
  return updated;
};

describe('objectif d’avis en masse', () => {
  beforeEach(async () => {
    await Folder.create({ name: 'À nous', detail: '', projectId: 1 });
    await Folder.create({ name: 'Au voisin', detail: '', projectId: 2 });
  });

  it('part à un avis par défaut', async () => {
    const created = await addCase(1, 'C1');
    expect(created.verdictsExpected).toBe(1);
  });

  it('porte l’objectif sur les cas du projet', async () => {
    const mine = await addCase(1, 'C1');

    expect(await updateExpected([mine.id], 2, 1)).toBe(1);
    expect((await Case.findByPk(mine.id)).verdictsExpected).toBe(2);
  });

  it('ne touche pas un cas d’un autre projet, même nommé explicitement', async () => {
    const theirs = await addCase(2, 'C2');

    expect(await updateExpected([theirs.id], 2, 1)).toBe(0);
    expect((await Case.findByPk(theirs.id)).verdictsExpected).toBe(1);
  });

  it('redescend à un avis quand le marqueur disparaît de l’énoncé', async () => {
    const mine = await addCase(1, 'C1');
    await updateExpected([mine.id], 2, 1);

    await updateExpected([mine.id], 1, 1);

    expect((await Case.findByPk(mine.id)).verdictsExpected).toBe(1);
  });
});
