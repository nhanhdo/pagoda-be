require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Kết nối database thành công.');

    await sequelize.sync();

    if (!process.env.DATABASE_URL) {
      // Xóa bảng backup còn sót từ lần sync lỗi trước (chỉ SQLite)
      const { QueryTypes } = require('sequelize');
      const backupTables = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_backup'",
        { type: QueryTypes.SELECT }
      );
      for (const t of backupTables) {
        await sequelize.query(`DROP TABLE IF EXISTS \`${t.name}\``);
      }
      // Thêm cột mới nếu chưa có (SQLite không hỗ trợ alter:true an toàn)
      await sequelize.query("ALTER TABLE posts ADD COLUMN userId INTEGER").catch(() => {});
      await sequelize.query("ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'approved'").catch(() => {});
    }
    console.log('Database đã đồng bộ.');

    app.listen(PORT, () => {
      console.log(`Server đang chạy tại http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Không thể khởi động server:', error);
    process.exit(1);
  }
}

startServer();
