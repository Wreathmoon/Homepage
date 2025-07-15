const Log = require('../models/log');

exports.writeLog = async ({ action, collection, itemId, operator, payload }) => {
  try {
    const log = await Log.create({ action, collection, itemId, operator, payload });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📝 系统日志已写入: ${action} ${collection} ${itemId}`);
    }
    return log;
  } catch (err) {
    console.error('写日志失败', err);
  }
}; 