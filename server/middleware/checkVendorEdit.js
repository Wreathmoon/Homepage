const User = require('../models/user');

module.exports = async function checkVendorEdit(req, res, next) {
    try {
        // admin 直接放行
        if (req.user && req.user.role === 'admin') {
            return next();
        }

        if (!req.user) {
            return res.status(401).json({ success: false, message: '未登录' });
        }

        // 读取最新用户信息，防止缓存
        const user = await User.findOne({ username: req.user.username }).lean();
        if (!user) {
            return res.status(401).json({ success: false, message: '用户不存在' });
        }

        const ve = user.vendorEditable || {};
        const now = new Date();
        if (ve.enabled && ve.expiresAt && ve.expiresAt > now) {
            return next();
        }

        return res.status(403).json({ success: false, message: '无供应商编辑权限或已过期' });
    } catch (err) {
        console.error('checkVendorEdit error', err);
        return res.status(500).json({ success: false, message: '内部错误' });
    }
}; 