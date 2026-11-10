export async function up(queryInterface) {
  // Les statuts déjà saisis deviennent des avis, sinon tout l'historique
  // paraîtrait non joué le jour où les rapports le liront.
  //
  // L'assigné est retenu comme auteur quand il y en a un : c'est la seule trace
  // de qui a joué le cas. Sans assigné, l'avis reste anonyme — un verdict sans
  // auteur vaut mieux qu'un verdict attribué au hasard.
  await queryInterface.sequelize.query(`
    INSERT INTO runCaseVerdicts (runCaseId, userId, status, createdAt, updatedAt)
    SELECT id, assigneeUserId, status, createdAt, updatedAt
    FROM runCases
    WHERE status <> 0
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('DELETE FROM runCaseVerdicts');
}
