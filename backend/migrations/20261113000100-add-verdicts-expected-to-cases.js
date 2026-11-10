export async function up(queryInterface, Sequelize) {
  // Combien d'avis distincts un cas attend avant d'être tenu pour terminé.
  //
  // Sur le CAS et non sur le lien à la campagne : ce sont les plans qui en
  // décident, comme ils décident déjà du rôle propriétaire. Un cas de calcul ou
  // de cloisonnement en demande deux, le reste un seul — exiger plusieurs avis
  // partout multiplierait la campagne par le nombre de testeurs.
  await queryInterface.addColumn('cases', 'verdictsExpected', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1,
  });
}

export async function down(queryInterface) {
  // SQLite ne retire pas une colonne : Sequelize recrée la table. Or `cases`
  // est référencée par `runCases` en ON DELETE CASCADE — la recréation emporte
  // alors TOUS les statuts de recette, des milliers de lignes, sans un mot.
  // Les contraintes sont donc suspendues le temps de l'opération.
  await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF');
  try {
    await queryInterface.removeColumn('cases', 'verdictsExpected');
  } finally {
    await queryInterface.sequelize.query('PRAGMA foreign_keys = ON');
  }
}
