export async function up(queryInterface, Sequelize) {
  // L'adresse du site que cette campagne éprouve.
  //
  // Sur le PROJET et non sur la campagne : les vagues d'un même projet visent
  // le même environnement, et répéter l'adresse sur chacune garantirait qu'une
  // d'elles finisse par pointer ailleurs après une bascule de domaine.
  await queryInterface.addColumn('projects', 'testUrl', {
    type: Sequelize.STRING,
    allowNull: true,
  });
}

export async function down(queryInterface) {
  // SQLite ne retire pas une colonne : Sequelize recrée la table. Or `projects`
  // est référencée en ON DELETE CASCADE par les dossiers, les campagnes et les
  // membres — la recréation emporterait tout le projet sans un mot.
  await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');
  try {
    await queryInterface.removeColumn('projects', 'testUrl');
  } finally {
    await queryInterface.sequelize.query('PRAGMA foreign_keys = ON');
  }
}
