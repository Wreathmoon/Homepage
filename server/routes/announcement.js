const express = require('express');
const router = express.Router();
const announcement = require('../services/announcement');

// 获取公告
router.get('/', (_req, res) => {
  res.json({ success: true, data: announcement.get() });
});

// 发布公告（admin only）
router.post('/', (req, res) => {
  const role = req.header('x-user-role');
  if (role !== 'admin') {
    return res.status(403).json({ success: false, message: '仅管理员可发布公告' });
  }
  const { msg } = req.body || {};
  if (!msg) return res.status(400).json({ success: false, message: '公告内容不能为空' });
  announcement.set(msg);
  res.json({ success: true });
});

module.exports = router; 