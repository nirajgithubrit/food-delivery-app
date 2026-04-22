const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {

  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send('Not authorized');
  }

  try {
    const decoded = jwt.verify(token, 'SECRET_KEY');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send('Invalid token');
  }
};

// 🔥 ROLE CHECK
exports.authorize = (...roles) => {
  return (req, res, next) => {

    if (!roles.includes(req.user.role)) {
      return res.status(403).send('Access denied');
    }

    next();
  };
};