const Log = require('../models/log');

exports.writeLog = async ({ action, collection, itemId, operator, payload }) => {
  try {
    await Log.create({ action, collection, itemId, operator, payload });
  } catch (err) {
    console.error('写日志失败', err);
  }
}; 