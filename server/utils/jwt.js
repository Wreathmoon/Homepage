const jwt = require('jsonwebtoken');

const {
  JWT_SECRET = 'dev_secret_key',
  JWT_ACCESS_EXPIRES = '20m',
  JWT_REFRESH_EXPIRES = '7d'
} = process.env;

exports.signAccess = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });

exports.signRefresh = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });

exports.verify = (token) => jwt.verify(token, JWT_SECRET); 