const { verify } = require('../utils/jwt');

// 需要跳过鉴权的路径
const WHITELIST = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/health'
];

const isPublicGet = (req) => {
  if (req.method !== 'GET') return false;
  return req.path.startsWith('/maintenance') || req.path.startsWith('/announcement');
};

module.exports = function jwtAuth(req, res, next) {
  // 跳过白名单或公开 GET 接口
  if (WHITELIST.includes(req.path) || isPublicGet(req)) return next();

  const authHeader = req.headers.authorization || '';
  if (!authHeader) {
    console.warn('JWTAuth: 无 Authorization 头', req.path);
  }
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未授权' });
  }
  const token = authHeader.slice(7);
  try {
    let payload;
    try {
      payload = verify(token);
    } catch(err) {
      console.warn('JWTAuth: token verify failed', err.message);
      throw err;
    }
    req.user = payload;
    // 向后兼容旧 header 判断
    req.headers['x-user-role'] = payload.role;
    req.headers['x-user-name'] = payload.name || payload.username;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      console.warn('JWTAuth: Access Token 已过期', new Date().toISOString());
    }
    return res.status(401).json({ success: false, message: 'Token 无效或已过期' });
  }
}; 