const express = require('express');
const router = express.Router();
const User = require('../models/user');
const RegistrationCode = require('../models/registrationCode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { signAccess, signRefresh, verify } = require('../utils/jwt');
const cookieParser = require('cookie-parser');

// 生成随机注册码
function generateRegistrationCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// 管理员权限检查中间件
const requireAdmin = (req, res, next) => {
    const userRole = (req.user && req.user.role) || req.headers['x-user-role'];
    if (userRole !== 'admin') {
        return res.status(403).json({
            success: false,
            message: '权限不足，需要管理员权限'
        });
    }
    next();
};

// 用户登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
        }

        const user = await User.findOne({ username, isActive: true });
        if (!user) {
            console.warn('登录失败: 用户不存在或未激活');
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }

        const match = await user.comparePassword(password);
        if (!match) {
            console.warn('登录失败: 密码不匹配');
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }

        const payload = { id: user._id, role: user.role, name: user.displayName };
        const accessToken = signAccess(payload);
        const refreshToken = signRefresh({ id: user._id });

        // httpOnly cookie 存 refreshToken
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 7 * 24 * 3600 * 1000
        });

        res.json({
            success: true,
            data: {
                accessToken,
                user: {
                    _id: user._id,
                    username: user.username,
                    displayName: user.displayName,
                    role: user.role,
                    vendorEditable: user.vendorEditable || { enabled: false, expiresAt: null }
                }
            }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ success: false, message: '登录失败', error: error.message });
    }
});

// 刷新 accessToken
router.post('/refresh', async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: '无刷新令牌' });
    try {
        const decoded = verify(token);
        const user = await User.findById(decoded.id);
        if (!user) throw new Error('用户不存在');
        const newAccessToken = signAccess({ id: user._id, role: user.role, name: user.displayName });
        res.json({ success: true, data: { accessToken: newAccessToken } });
    } catch (err) {
        return res.status(401).json({ success: false, message: '刷新令牌无效' });
    }
});

// 用户注册
router.post('/register', async (req, res) => {
    try {
        const { username, password, displayName, registrationCode } = req.body;

        if (!username || !password || !displayName || !registrationCode) {
            return res.status(400).json({
                success: false,
                message: '所有字段都是必填的'
            });
        }

        // 验证注册码
        const regCode = await RegistrationCode.findOne({
            code: registrationCode,
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });

        if (!regCode) {
            return res.status(400).json({
                success: false,
                message: '注册码无效或已过期'
            });
        }

        // 检查用户名是否已存在
        const existingUser = await User.findOne({ username: username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '用户名已存在'
            });
        }

        // 创建新用户
        const newUser = new User({
            username,
            password, // 注意：实际生产环境应该加密密码
            displayName,
            role: 'user',
            createdBy: regCode.createdBy
        });

        await newUser.save();

        // 标记注册码为已使用
        regCode.isUsed = true;
        regCode.usedBy = username;
        regCode.usedAt = new Date();
        await regCode.save();

        res.status(201).json({
            success: true,
            message: '注册成功',
            data: {
                username: newUser.username,
                displayName: newUser.displayName,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({
            success: false,
            message: '注册失败',
            error: error.message
        });
    }
});

// 获取所有用户（管理员专用）
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({ isActive: true })
            .select('-password')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户列表失败',
            error: error.message
        });
    }
});

// 删除用户（管理员专用）
router.delete('/users/:userId', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUser = req.headers['x-user-name'];

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 防止管理员删除自己
        if (user.username === currentUser) {
            return res.status(400).json({
                success: false,
                message: '不能删除自己的账号'
            });
        }

        // 软删除：设置为不活跃
        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: '用户删除成功'
        });

    } catch (error) {
        console.error('删除用户失败:', error);
        res.status(500).json({
            success: false,
            message: '删除用户失败',
            error: error.message
        });
    }
});

// 管理员重置用户密码
router.put('/users/:userId/reset-password', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user || !user.isActive) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        // 设置为默认密码，触发 pre('save') 自动哈希
        user.password = 'password123!';
        await user.save();

        res.json({ success: true, message: '密码已重置为默认值' });
    } catch (error) {
        console.error('重置密码失败:', error);
        res.status(500).json({ success: false, message: '重置密码失败', error: error.message });
    }
});

// 生成注册码（管理员专用）
router.post('/registration-codes', requireAdmin, async (req, res) => {
    try {
        const createdBy = req.headers['x-user-name'];
        
        let code;
        let attempts = 0;
        const maxAttempts = 10;

        // 生成唯一的注册码
        do {
            code = generateRegistrationCode();
            attempts++;
            
            if (attempts > maxAttempts) {
                throw new Error('生成唯一注册码失败，请重试');
            }
            
            const existingCode = await RegistrationCode.findOne({ code });
            if (!existingCode) break;
        } while (true);

        // 设置24小时后过期
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1);

        const registrationCode = new RegistrationCode({
            code,
            expiresAt,
            createdBy
        });

        await registrationCode.save();

        res.status(201).json({
            success: true,
            message: '注册码生成成功',
            data: {
                code: registrationCode.code,
                expiresAt: registrationCode.expiresAt
            }
        });

    } catch (error) {
        console.error('生成注册码失败:', error);
        res.status(500).json({
            success: false,
            message: '生成注册码失败',
            error: error.message
        });
    }
});

// 获取注册码列表（管理员专用）
router.get('/registration-codes', requireAdmin, async (req, res) => {
    try {
        const codes = await RegistrationCode.find({
            expiresAt: { $gt: new Date() } // 只显示未过期的
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: codes
        });

    } catch (error) {
        console.error('获取注册码列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取注册码列表失败',
            error: error.message
        });
    }
});

// 删除注册码（管理员专用）
router.delete('/registration-codes/:codeId', requireAdmin, async (req, res) => {
    try {
        const { codeId } = req.params;

        const code = await RegistrationCode.findById(codeId);
        if (!code) {
            return res.status(404).json({
                success: false,
                message: '注册码不存在'
            });
        }

        await code.deleteOne();

        res.json({
            success: true,
            message: '注册码删除成功'
        });

    } catch (error) {
        console.error('删除注册码失败:', error);
        res.status(500).json({
            success: false,
            message: '删除注册码失败',
            error: error.message
        });
    }
});

// 修改密码
router.post('/change-password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;

        if (!username || !oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: '用户名、旧密码和新密码都是必填的'
            });
        }

        // 验证新密码强度
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: '新密码至少需要6个字符'
            });
        }

        // 查找用户
        const user = await User.findOne({ username, isActive: true });
        if (!user) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }

        // 使用 comparePassword 校验旧密码（支持明文到哈希升级）
        const match = await user.comparePassword(oldPassword);
        if (!match) {
            return res.status(401).json({ success: false, message: '旧密码错误' });
        }

        // 设置新密码（触发 pre('save') 自动哈希）
        user.password = newPassword;
        user.updatedAt = new Date();
        await user.save();

        res.json({
            success: true,
            message: '密码修改成功'
        });

    } catch (error) {
        console.error('修改密码失败:', error);
        res.status(500).json({
            success: false,
            message: '修改密码失败',
            error: error.message
        });
    }
});

module.exports = router; 