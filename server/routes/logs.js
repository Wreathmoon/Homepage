const express = require('express');
const router = express.Router();
const Log = require('../models/log');

// 临时管理员鉴权：从 req.headers['x-role'] == 'admin' 判断；实际应替换
const isAdmin = (req, res, next) => {
  if (req.headers['x-role'] === 'admin') return next();
  return res.status(403).json({ success: false, message: '无权限' });
};

router.get('/', isAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      Log.find().sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)).lean(),
      Log.countDocuments()
    ]);
    res.json({ success: true, data, total });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取日志失败', error: e.message });
  }
});

module.exports = router; 