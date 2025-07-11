const express = require('express');
const router = express.Router();
const User = require('../models/user');
const auth = require('../middleware/auth'); // 假设已有 auth 中间件设置 req.user

// 仅管理员可调用
router.post('/:id/vendor-edit', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '只有管理员可操作' });
        }

        const { enable, hours = 5 } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        if (enable) {
            const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
            user.vendorEditable = { enabled: true, expiresAt };
        } else {
            user.vendorEditable = { enabled: false, expiresAt: null };
        }
        await user.save();

        res.json({ success: true, data: user.vendorEditable });
    } catch (err) {
        console.error('授权供应商编辑权限失败', err);
        res.status(500).json({ success: false, message: '内部错误' });
    }
});

module.exports = router; 