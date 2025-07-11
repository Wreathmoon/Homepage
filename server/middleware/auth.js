module.exports = function auth(req, res, next) {
    // 从请求头读取用户信息 (前端需在请求头中附带)
    const role = req.headers['x-user-role'] || 'user';
    const username = req.headers['x-user'] ? decodeURIComponent(req.headers['x-user']) : undefined;

    if (!username) {
        return res.status(401).json({ success: false, message: '未登录' });
    }

    req.user = {
        username,
        role,
        // 如果需要，后续可添加 _id 等字段
    };

    next();
}; 