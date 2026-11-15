require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Kết nối database thành công.');

    // Seed the Buddha & Bodhisattva library only the first time its table is created
    // (so deleting entries later doesn't bring the defaults back on restart)
    const libraryExisted = await sequelize.getQueryInterface().describeTable('buddha_figures').then(() => true, () => false);

    await sequelize.sync();

    if (!libraryExisted) {
      const { BuddhaFigure } = require('./src/models');
      if ((await BuddhaFigure.count()) === 0) {
        await BuddhaFigure.bulkCreate(BuddhaFigure.DEFAULTS);
        console.log(`[seed] Thư viện Phật & Bồ Tát: ${BuddhaFigure.DEFAULTS.length} mục`);
      }
    }

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
    await require('./src/config/migrate').runMigrations(sequelize);
    console.log('Database đã đồng bộ.');

    app.listen(PORT, () => {
      console.log(`Server đang chạy tại http://localhost:${PORT}`);
    });

    require('./src/services/backup').scheduleDailyBackups();
  } catch (error) {
    console.error('Không thể khởi động server:', error);
    process.exit(1);
  }
}

startServer();
