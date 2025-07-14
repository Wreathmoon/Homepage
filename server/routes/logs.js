const express = require('express');
const router = express.Router();
const Log = require('../models/log');

// 临时管理员鉴权：支持旧 x-role 和新 x-user-role
const isAdmin = (req, res, next) => {
  const role = req.headers['x-role'] || req.headers['x-user-role'];
  if (role === 'admin') return next();
  return res.status(403).json({ success: false, message: '无权限' });
};

router.get('/', isAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (page - 1) * pageSize;
    const [rawData, total] = await Promise.all([
      Log.find().sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)).lean(),
      Log.countDocuments()
    ]);

    // 对操作人字段进行解码，保证中文显示正常
    const data = rawData.map(item => ({
      ...item,
      operator: item.operator ? decodeURIComponent(item.operator) : item.operator
    }));
    res.json({ success: true, data, total });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取日志失败', error: e.message });
  }
});

router.get('/export', isAdmin, async (req, res) => {
  try {
    const { start, end, format = 'csv' } = req.query;
    const query = {};
    if (start) query.createdAt = { ...query.createdAt, $gte: new Date(start) };
    if (end) query.createdAt = { ...query.createdAt, $lte: new Date(end) };

    const logs = await Log.find(query).sort({ createdAt: -1 }).lean();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="logs_${Date.now()}.json"`);
      return res.send(JSON.stringify(logs));
    }

    // 默认CSV
    const headers = ['createdAt', 'action', 'collection', 'operator', 'itemId', 'payload'];
    const csvLines = [headers.join(',')];
    for (const l of logs) {
      const row = [
        new Date(l.createdAt).toISOString(),
        l.action,
        l.collection,
        decodeURIComponent(l.operator || ''),
        l.itemId || '',
        JSON.stringify(l.payload || {}).replace(/"/g, '""')
      ];
      csvLines.push(row.map(v => `"${v}"`).join(','));
    }
    const csvContent = '\uFEFF' + csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="logs_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (e) {
    console.error('导出日志失败', e);
    res.status(500).json({ success: false, message: '导出日志失败', error: e.message });
  }
});

module.exports = router; 