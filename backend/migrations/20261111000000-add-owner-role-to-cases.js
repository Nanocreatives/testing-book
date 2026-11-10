export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('cases', 'ownerRole', {
    type: Sequelize.INTEGER,
    allowNull: true,
  });
}

export async function down(queryInterface) {
  // SQLite ne retire pas une colonne : Sequelize recrée la table. Or `cases`
  // est référencée par `runCases` en ON DELETE CASCADE — la recréation emportait
  // TOUS les statuts de recette, des milliers de lignes, sans un mot. Les
  // contraintes sont donc suspendues le temps de l'opération.
  await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');
  try {
    await queryInterface.removeColumn('cases', 'ownerRole');
  } finally {
    await queryInterface.sequelize.query('PRAGMA foreign_keys = ON');
  }
}
