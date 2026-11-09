export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('runs', 'instructions', {
    type: Sequelize.TEXT,
    allowNull: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('runs', 'instructions');
}
