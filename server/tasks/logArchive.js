const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const archiver = require('archiver');
const Log = require('../models/log');
const { writeLog } = require('../services/logger');

// 若脚本独立执行（app.js 未先建立连接），自动连接 MongoDB
const mongoose = require('mongoose');
if (mongoose.connection.readyState === 0) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quotation_system';
  mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('[LogArchive] MongoDB connected'))
    .catch(err => console.error('[LogArchive] Mongo connect error', err));
}

// 环境变量可覆盖
const EXPORT_DIR = process.env.LOG_ARCHIVE_DIR || path.join(__dirname, '..', 'archived-logs');
const RETAIN_MONTHS = Number(process.env.LOG_RETENTION_MONTHS || 3); // 本地保留最近 N 个月

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exportLogsCsvJson(range, outDir) {
  const { start, end } = range;
  const query = { createdAt: { $gte: start, $lt: end } };
  const logs = await Log.find(query).lean();

  // CSV
  const csvLines = ['createdAt,action,collection,operator,itemId,payload'];
  logs.forEach(l => {
    csvLines.push([
      new Date(l.createdAt).toISOString(),
      l.action,
      l.collection,
      decodeURIComponent(l.operator || ''),
      l.itemId || '',
      JSON.stringify(l.payload || {}).replace(/"/g, '""')
    ].map(v => `"${v}"`).join(','));
  });
  await fs.writeFile(path.join(outDir, `logs_${range.label}.csv`), '\uFEFF' + csvLines.join('\n'));

  // JSON
  await fs.writeFile(path.join(outDir, `logs_${range.label}.json`), JSON.stringify(logs, null, 2));
}

async function compressDir(dir, label) {
  const zipPath = path.join(dir, `logs_${label}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = require('fs').createWriteStream(zipPath);
  archive.pipe(output);
  archive.file(path.join(dir, `logs_${label}.csv`), { name: `logs_${label}.csv` });
  archive.file(path.join(dir, `logs_${label}.json`), { name: `logs_${label}.json` });
  await archive.finalize();
  return zipPath;
}

async function cleanupOldLocal(retainMonths) {
  const border = new Date();
  border.setUTCMonth(border.getUTCMonth() - retainMonths);
  const dirs = await fs.readdir(EXPORT_DIR, { withFileTypes: true });
  for (const d of dirs) {
    if (d.isDirectory()) {
      const dirDate = new Date(`${d.name}-01T00:00:00Z`);
      if (!isNaN(dirDate) && dirDate < border) {
        await fs.rm(path.join(EXPORT_DIR, d.name), { recursive: true, force: true });
      }
    }
  }
}

async function runArchiveTask() {
  const now = new Date();
  const label = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthDir = path.join(EXPORT_DIR, label);
  await ensureDir(monthDir);
  // 导出全部日志（不限定时间）
  const logs = await Log.find({}).lean();

  // CSV
  const csvLines = ['createdAt,action,collection,operator,itemId,payload'];
  logs.forEach(l => {
    csvLines.push([
      new Date(l.createdAt).toISOString(),
      l.action,
      l.collection,
      decodeURIComponent(l.operator || ''),
      l.itemId || '',
      JSON.stringify(l.payload || {}).replace(/"/g, '""')
    ].map(v => `"${v}"`).join(','));
  });
  await fs.writeFile(path.join(monthDir, `logs_${label}.csv`), '\uFEFF' + csvLines.join('\n'));

  // JSON
  await fs.writeFile(path.join(monthDir, `logs_${label}.json`), JSON.stringify(logs, null, 2));

  await compressDir(monthDir, label);

  // 删除原始 CSV / JSON，仅保留压缩包
  try {
    await fs.unlink(path.join(monthDir, `logs_${label}.csv`));
    await fs.unlink(path.join(monthDir, `logs_${label}.json`));
  } catch (e) {
    console.warn('[LogArchive] 删除临时文件失败', e.message);
  }

  // 写一条系统日志
  writeLog({
    action: 'EXPORT',
    collection: 'logs',
    itemId: null,
    operator: 'system',
    payload: { label, count: logs.length }
  });

  // 可选：删除数据库日志（启用需设置环境变量 LOG_ARCHIVE_DELETE=true）
  if (process.env.LOG_ARCHIVE_DELETE === 'true') {
    await Log.deleteMany({});
    console.log('[LogArchive] All logs cleared from MongoDB after export');
  }

  console.log(`[LogArchive] Exported and archived ALL logs -> ${label}, total ${logs.length}`);
}

// 每月 2 日凌晨 03:00 运行
cron.schedule('0 3 2 * *', runArchiveTask, { timezone: 'UTC' });

module.exports = { runArchiveTask }; 