const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('mongo-sanitize');
const xss = require('xss');
const dotenv = require('dotenv');
const cron = require('node-cron');
const { fork } = require('child_process');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
const allowedOrigins = process.env.FRONTEND_URL ? 
    process.env.FRONTEND_URL.split(',').map(url => url.trim()) : 
    ['http://localhost:3000', 'http://localhost:8080', 'http://103.77.22.42', 'http://103.77.22.42:8080'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// NoSQL 注入清理
app.use((req, _res, next) => {
  if (req.body) req.body = mongoSanitize(req.body);
  if (req.query) req.query = mongoSanitize(req.query);
  if (req.params) req.params = mongoSanitize(req.params);
  next();
});

// 解析 httpOnly cookie
app.use(cookieParser());

// 静态文件服务 - 用于提供上传的文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation_system';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB连接成功');
    console.log(`📦 数据库: ${MONGODB_URI}`);
})
.catch((error) => {
    console.error('❌ MongoDB连接失败:', error);
    process.exit(1);
});

// 导入路由
const vendorRoutes = require('./routes/vendors');   
const quotationRoutes = require('./routes/quotations');
const uploadRoutes = require('./routes/upload');
const authRoutes = require('./routes/auth');
const jwtAuth = require('./middlewares/jwtAuth');
const logRoutes = require('./routes/logs');
const userRoutes = require('./routes/users');
const maintenanceRoutes = require('./routes/maintenance');
const announcementRoutes = require('./routes/announcement');
const { get: getMaintenance } = require('./services/maintenance');

// 路由配置
// 登录、注册等开放接口
app.use('/api/auth', authRoutes);

// JWT 鉴权中间件（放在业务路由之前）
app.use('/api', jwtAuth);

// 业务路由
app.use('/api/vendors', vendorRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/products', quotationRoutes); // 兼容现有前端API
app.use('/api/upload', uploadRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/users', userRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/announcement', announcementRoutes);

// 写请求维护期阻断
app.use((req, res, next) => {
  const maint = getMaintenance();
  if (maint.status === 'maintenance' && req.method !== 'GET' && !req.path.startsWith('/api/maintenance')) {
    return res.status(503).json({ success: false, message: '系统维护中，请稍后再试' });
  }
  next();
});

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    
    // MongoDB验证错误
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
            success: false,
            message: '数据验证失败',
            errors
        });
    }
    
    // MongoDB重复键错误
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({
            success: false,
            message: `${field} 已存在，请使用其他值`
        });
    }
    
    // 文件上传错误
    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: '文件上传失败: ' + error.message
        });
    }
    
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? error.message : '请稍后重试'
    });
});

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `路径 ${req.originalUrl} 不存在`
    });
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务器...');
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
    process.exit(0);
});

// 每月1日 02:00 备份供应商
cron.schedule('0 2 1 * *', () => {
  const taskPath = path.join(__dirname, 'tasks', 'vendorBackup.js');
  fork(taskPath);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`🌍 允许的跨域源: ${allowedOrigins.join(',')}`);
    console.log(`📁 上传文件目录: ${path.join(__dirname, 'uploads')}`);
 
       // 启动定时日志归档任务
       try {
         require('./tasks/logArchive');
       } catch (err) {
         console.warn('logArchive 任务未启动:', err.message);
       }
   });