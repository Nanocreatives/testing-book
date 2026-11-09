export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('stages', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    projectId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    position: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    kind: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    title: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    content: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    runId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'runs',
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
}

export async function down(queryInterface) {
  await queryInterface.dropTable('stages');
}
