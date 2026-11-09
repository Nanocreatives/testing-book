// A stage of a project's guided path, not to be confused with models/steps.js,
// which holds the steps of a single test case.
function defineStage(sequelize, DataTypes) {
  const Stage = sequelize.define('Stage', {
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    // Rank in the path. Gaps are harmless: only the order matters.
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Index into stageKinds of frontend/config/selection.ts: briefing, run.
    kind: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // What a briefing stage asks the reporter to read. Null on run stages.
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // The run a run stage points at. Null on briefing stages.
    runId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'runs',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  });

  Stage.associate = (models) => {
    Stage.belongsTo(models.Project, { foreignKey: 'projectId', onDelete: 'CASCADE' });
    Stage.belongsTo(models.Run, { foreignKey: 'runId', onDelete: 'CASCADE' });
    Stage.hasMany(models.StageCompletion, { foreignKey: 'stageId', onDelete: 'CASCADE' });
  };

  return Stage;
}

export default defineStage;
