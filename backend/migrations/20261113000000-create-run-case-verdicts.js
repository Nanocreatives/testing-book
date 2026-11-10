export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('runCaseVerdicts', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    runCaseId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'runCases',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    // Nullable, et SET NULL à la suppression du compte : un verdict reste un
    // fait de recette même quand son auteur quitte le projet. Les statuts
    // repris de l'ancien modèle arrivent d'ailleurs sans auteur.
    userId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    status: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  });

  // Une personne n'a qu'un avis par cas : le second remplace le premier plutôt
  // que de s'y ajouter, sinon le compte d'avis enflerait à chaque correction.
  await queryInterface.addIndex('runCaseVerdicts', ['runCaseId', 'userId'], {
    unique: true,
    name: 'run_case_verdicts_run_case_user',
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('runCaseVerdicts');
}
