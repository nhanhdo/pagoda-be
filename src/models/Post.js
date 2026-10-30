const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Post = sequelize.define('Post', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: true },
  type: {
    type: DataTypes.ENUM('event', 'news', 'article'),
    allowNull: false,
    defaultValue: 'news',
    comment: 'event=Sự kiện, news=Tin nhanh, article=Bài viết',
  },
  coverImage: { type: DataTypes.STRING(255), allowNull: true },
  eventDate: { type: DataTypes.DATEONLY, allowNull: true, comment: 'Ngày diễn ra (chỉ dùng cho event)' },
  eventTime: { type: DataTypes.STRING(10), allowNull: true },
  eventLocation: { type: DataTypes.STRING(200), allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'approved',
    comment: 'pending=chờ duyệt, approved=đã duyệt, rejected=từ chối',
  },
  isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
  isPinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  authorId: { type: DataTypes.INTEGER, allowNull: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'posts',
  timestamps: true,
});

module.exports = Post;
