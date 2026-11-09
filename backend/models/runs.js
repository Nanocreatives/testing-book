function defineRun(sequelize, DataTypes) {
  const Run = sequelize.define('Run', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    configurations: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // How the run must be executed: conventions, prerequisites, what counts as
    // passed. TEXT rather than STRING because this is prose, not a label.
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    state: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'project',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  });

  Run.associate = (models) => {
    Run.belongsTo(models.Project, { foreignKey: 'projectId', onDelete: 'CASCADE' });
  };

  return Run;
}

export default defineRun;
