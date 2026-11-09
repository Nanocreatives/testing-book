// One row per reporter who acknowledged a briefing stage. Run stages are not
// recorded here: their progress is read from the run itself.
function defineStageCompletion(sequelize, DataTypes) {
  const StageCompletion = sequelize.define('StageCompletion', {
    stageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'stages',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  });

  StageCompletion.associate = (models) => {
    StageCompletion.belongsTo(models.Stage, { foreignKey: 'stageId', onDelete: 'CASCADE' });
    StageCompletion.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return StageCompletion;
}

export default defineStageCompletion;
