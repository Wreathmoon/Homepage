const express = require('express');
const router = express.Router();
const maintenance = require('../services/maintenance');

// 预告维护
router.post('/schedule', (req, res) => {
  const { delay = 60, msg } = req.body || {};
  maintenance.schedule(Number(delay), msg);
  res.json({ success: true });
});
// 结束维护
router.post('/stop', (_req, res) => {
  maintenance.stop();
  res.json({ success: true });
});
// 获取状态
router.get('/', (_req, res) => {
  res.json({ success: true, data: maintenance.get() });
});

module.exports = router; 