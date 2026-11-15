const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
// Backup routes parse their own (large) JSON bodies; everything else keeps the default limit.
const defaultJson = express.json();
app.use((req, res, next) => (req.path.startsWith('/api/backup/') ? next() : defaultJson(req, res, next)));
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
app.use('/api/donations', require('./routes/donations'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/funds', require('./routes/funds'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ceremonies', require('./routes/ceremonies'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/memorial-tablets', require('./routes/memorialTablets'));
app.use('/api/library', require('./routes/library'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Lỗi server nội bộ', error: err.message });
});

module.exports = app;
