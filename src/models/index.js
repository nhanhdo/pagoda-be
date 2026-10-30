const { sequelize } = require('../config/database');
const User = require('./User');
const Personnel = require('./Personnel');
const Department = require('./Department');
const DutySchedule = require('./DutySchedule');
const WorkAssignment = require('./WorkAssignment');
const Training = require('./Training');
const TrainingParticipant = require('./TrainingParticipant');
const RewardDiscipline = require('./RewardDiscipline');
const BuddhistFollower = require('./BuddhistFollower');
const Post = require('./Post');

// Associations
Department.hasMany(Personnel, { foreignKey: 'departmentId', as: 'members' });
Personnel.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

Personnel.hasOne(User, { foreignKey: 'personnelId', as: 'account' });
User.belongsTo(Personnel, { foreignKey: 'personnelId', as: 'personnel' });

Personnel.hasMany(DutySchedule, { foreignKey: 'personnelId', as: 'dutySchedules' });
DutySchedule.belongsTo(Personnel, { foreignKey: 'personnelId', as: 'personnel' });

Personnel.hasMany(WorkAssignment, { foreignKey: 'personnelId', as: 'workAssignments' });
WorkAssignment.belongsTo(Personnel, { foreignKey: 'personnelId', as: 'personnel' });

Training.hasMany(TrainingParticipant, { foreignKey: 'trainingId', as: 'participants' });
TrainingParticipant.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });

Personnel.hasMany(TrainingParticipant, { foreignKey: 'personnelId', as: 'trainingHistory' });
TrainingParticipant.belongsTo(Personnel, { foreignKey: 'personnelId', as: 'personnel' });

Personnel.hasMany(RewardDiscipline, { foreignKey: 'personnelId', as: 'rewardDisciplines' });
RewardDiscipline.belongsTo(Personnel, { foreignKey: 'personnelId', as: 'personnel' });

Personnel.hasMany(Post, { foreignKey: 'authorId', as: 'posts' });
Post.belongsTo(Personnel, { foreignKey: 'authorId', as: 'author' });

User.hasMany(Post, { foreignKey: 'userId', as: 'userPosts' });
Post.belongsTo(User, { foreignKey: 'userId', as: 'userAuthor' });

module.exports = {
  sequelize,
  User,
  Personnel,
  Department,
  DutySchedule,
  WorkAssignment,
  Training,
  TrainingParticipant,
  RewardDiscipline,
  BuddhistFollower,
  Post,
};
