const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Comment = sequelize.define('Comment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  postId: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  authorId: { type: DataTypes.INTEGER, allowNull: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  // Replies (Facebook style, one level): parentId = top-level comment of the thread,
  // replyToId = the comment actually being answered (may be another reply in the thread).
  parentId: { type: DataTypes.INTEGER, allowNull: true },
  replyToId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'comments',
  timestamps: true,
});

module.exports = Comment;
