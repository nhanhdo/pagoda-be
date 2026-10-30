const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/personnel', require('./routes/personnel'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/duty-schedules', require('./routes/dutySchedules'));
app.use('/api/work-assignments', require('./routes/workAssignments'));
app.use('/api/trainings', require('./routes/trainings'));
app.use('/api/reward-disciplines', require('./routes/rewardDisciplines'));
app.use('/api/buddhist-followers', require('./routes/buddhistFollowers'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/users', require('./routes/users'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Lỗi server nội bộ', error: err.message });
});

module.exports = app;
