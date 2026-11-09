export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('cases', 'ownerRole', {
    type: Sequelize.INTEGER,
    allowNull: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('cases', 'ownerRole');
}
