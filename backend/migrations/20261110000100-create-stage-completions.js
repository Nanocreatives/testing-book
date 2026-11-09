export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('stageCompletions', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    stageId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'stages',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
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

  await queryInterface.addConstraint('stageCompletions', {
    fields: ['stageId', 'userId'],
    type: 'unique',
    name: 'stageCompletions_stageId_userId_unique',
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('stageCompletions');
}
