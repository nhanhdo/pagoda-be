const jwt = require('jsonwebtoken');
const { User } = require('../models');

const SEEN_THROTTLE_MS = 30 * 1000;

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Tài khoản không hợp lệ' });
    }

    req.user = user;
    // Presence: write at most every 30s per user, without delaying the request.
    // A request flagged x-presence: off (logout) must not mark the user online again.
    const seen = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
    if (Date.now() - seen > SEEN_THROTTLE_MS && req.headers['x-presence'] !== 'off') {
      user.lastSeenAt = new Date();
      User.update({ lastSeenAt: user.lastSeenAt }, { where: { id: user.id }, silent: true, hooks: false })
        .catch(() => { /* presence is best-effort */ });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Không có quyền thực hiện thao tác này' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
