const express = require('express');
const router = express.Router();

// 注册AI路由
router.use('/ai', require('./ai'));

// 其他路由...

module.exports = router; 