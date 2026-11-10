// One row per person who gave a verdict on a case of a run.
//
// `RunCase.status` remains the AGGREGATE — what the lists and the chart read.
// It is derived from these rows, never edited on its own: two sources of truth
// for the same verdict would diverge the first time one write failed.
function defineRunCaseVerdict(sequelize, DataTypes) {
  const RunCaseVerdict = sequelize.define(
    'RunCaseVerdict',
    {
      runCaseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      // Nommée explicitement : Sequelize pluraliserait en `RunCaseVerdicts`
      // alors que les migrations du dépôt créent des tables à initiale
      // minuscule. SQLite ne distingue pas la casse et masquerait l'écart.
      tableName: 'runCaseVerdicts',
      indexes: [{ unique: true, fields: ['runCaseId', 'userId'] }],
    }
  );

  RunCaseVerdict.associate = (models) => {
    RunCaseVerdict.belongsTo(models.RunCase, {
      foreignKey: 'runCaseId',
      onDelete: 'CASCADE',
    });
    RunCaseVerdict.belongsTo(models.User, {
      as: 'author',
      foreignKey: 'userId',
      onDelete: 'SET NULL',
    });
  };

  return RunCaseVerdict;
}

export default defineRunCaseVerdict;
