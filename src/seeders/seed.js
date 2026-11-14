require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User, Personnel, Department } = require('../models');

async function seed() {
  try {
    await sequelize.sync({ force: true });
    console.log('Database đã được reset.');

    const departments = await Department.bulkCreate([
      { code: 'BAN_HOT_TU', name: 'Ban Hộ Tự', description: 'Ban hộ trì ngôi chùa' },
      { code: 'BAN_PHAP_SU', name: 'Ban Pháp Sự', description: 'Quản lý các pháp sự' },
      { code: 'BAN_VAN_HOA', name: 'Ban Văn Hóa', description: 'Hoạt động văn hóa, giáo dục' },
      { code: 'BAN_TU_THIEN', name: 'Ban Từ Thiện', description: 'Hoạt động từ thiện xã hội' },
      { code: 'BAN_TAI_CHINH', name: 'Ban Tài Chính', description: 'Quản lý tài chính' },
    ]);

    const personnel = await Personnel.bulkCreate([
      {
        code: 'NS0001', fullName: 'Thích Minh Tuệ', dharmName: 'Minh Tuệ',
        gender: 'nam', type: 'tang_ni', position: 'trụ_trì',
        departmentId: departments[0].id, status: 'đang_hoạt_động',
        phone: '0901234567', ordinationDate: '2000-03-15',
        precept: 'Hòa Thượng', buddhismEducation: 'Cao cấp Phật học',
      },
      {
        code: 'NS0002', fullName: 'Thích Thiện Tâm', dharmName: 'Thiện Tâm',
        gender: 'nam', type: 'tang_ni', position: 'phó_trụ_trì',
        departmentId: departments[1].id, status: 'đang_hoạt_động',
        phone: '0901234568', ordinationDate: '2005-06-20',
        precept: 'Thượng Tọa',
      },
      {
        code: 'NS0003', fullName: 'Thích Nữ Huệ Từ', dharmName: 'Huệ Từ',
        gender: 'nữ', type: 'tang_ni', position: 'tri_khách',
        departmentId: departments[0].id, status: 'đang_hoạt_động',
        phone: '0901234569',
      },
      {
        code: 'NS0004', fullName: 'Nguyễn Văn Bình', dharmName: 'Thiện Bình',
        gender: 'nam', type: 'cu_si', position: 'thủ_quỹ',
        departmentId: departments[4].id, status: 'đang_hoạt_động',
        phone: '0901234570',
      },
      {
        code: 'NS0005', fullName: 'Trần Thị Lan', dharmName: 'Diệu Lan',
        gender: 'nữ', type: 'cu_si', position: 'thư_ký',
        departmentId: departments[0].id, status: 'đang_hoạt_động',
        phone: '0901234571',
      },
    ]);

    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('123456', 10);

    await User.bulkCreate([
      { username: 'admin', password: adminPassword, role: 'admin', personnelId: null },
      { username: 'truotri', password: userPassword, role: 'truotri', personnelId: personnel[0].id },
      { username: 'thuki', password: userPassword, role: 'thuki', personnelId: personnel[4].id },
    ]);

    console.log('Seed dữ liệu mẫu thành công!');
    console.log('Tài khoản mặc định:');
    console.log('  admin / admin123 (Quản trị hệ thống)');
    console.log('  truotri / 123456 (Trụ trì)');
    console.log('  thuki / 123456 (Thư ký)');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi seed:', error);
    process.exit(1);
  }
}

seed();
