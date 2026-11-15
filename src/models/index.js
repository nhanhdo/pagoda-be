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
const Donation = require('./Donation');
const Post = require('./Post');
const Comment = require('./Comment');
const BuddhaFigure = require('./BuddhaFigure');
const Fund = require('./Fund');
const Expense = require('./Expense');
const Ceremony = require('./Ceremony');
const CeremonyRegistration = require('./CeremonyRegistration');
const CeremonyEntry = require('./CeremonyEntry');
const MemorialTablet = require('./MemorialTablet');

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

BuddhistFollower.hasMany(Donation, { foreignKey: 'buddhistFollowerId', as: 'donations' });
Donation.belongsTo(BuddhistFollower, { foreignKey: 'buddhistFollowerId', as: 'buddhistFollower' });

Personnel.hasMany(Post, { foreignKey: 'authorId', as: 'posts' });
Post.belongsTo(Personnel, { foreignKey: 'authorId', as: 'author' });

User.hasMany(Post, { foreignKey: 'userId', as: 'userPosts' });
Post.belongsTo(User, { foreignKey: 'userId', as: 'userAuthor' });

Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments' });
Comment.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

Personnel.hasMany(Comment, { foreignKey: 'authorId', as: 'commentsMade' });
Comment.belongsTo(Personnel, { foreignKey: 'authorId', as: 'commentAuthor' });

User.hasMany(Comment, { foreignKey: 'userId', as: 'userComments' });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'commentUser' });

// Finance
Fund.hasMany(Donation, { foreignKey: 'fundId', as: 'donations', constraints: false });
Donation.belongsTo(Fund, { foreignKey: 'fundId', as: 'fund', constraints: false });
Fund.hasMany(Expense, { foreignKey: 'fundId', as: 'expenses' });
Expense.belongsTo(Fund, { foreignKey: 'fundId', as: 'fund' });
Expense.belongsTo(User, { foreignKey: 'createdBy', as: 'creator', constraints: false });
Expense.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver', constraints: false });

// Ceremonies (cầu an / cầu siêu) & memorial tablets — soft links (constraints: false) so
// deleting a fund/follower/donation never cascades into ceremony records.
Ceremony.belongsTo(Fund, { foreignKey: 'defaultFundId', as: 'defaultFund', constraints: false });
Ceremony.hasMany(CeremonyRegistration, { foreignKey: 'ceremonyId', as: 'registrations' });
CeremonyRegistration.belongsTo(Ceremony, { foreignKey: 'ceremonyId', as: 'ceremony' });
CeremonyRegistration.hasMany(CeremonyEntry, { foreignKey: 'registrationId', as: 'entries' });
CeremonyEntry.belongsTo(CeremonyRegistration, { foreignKey: 'registrationId', as: 'registration' });
CeremonyRegistration.belongsTo(Fund, { foreignKey: 'fundId', as: 'fund', constraints: false });
CeremonyRegistration.belongsTo(Donation, { foreignKey: 'donationId', as: 'donation', constraints: false });
CeremonyRegistration.belongsTo(BuddhistFollower, { foreignKey: 'buddhistFollowerId', as: 'buddhistFollower', constraints: false });
CeremonyRegistration.belongsTo(User, { foreignKey: 'createdBy', as: 'creator', constraints: false });
CeremonyEntry.belongsTo(MemorialTablet, { foreignKey: 'memorialTabletId', as: 'tablet', constraints: false });
MemorialTablet.belongsTo(BuddhistFollower, { foreignKey: 'buddhistFollowerId', as: 'buddhistFollower', constraints: false });

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
  Donation,
  Post,
  Comment,
  Fund,
  Expense,
  Ceremony,
  CeremonyRegistration,
  CeremonyEntry,
  MemorialTablet,
  BuddhaFigure,
};
