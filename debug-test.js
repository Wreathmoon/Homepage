const express = require('express');
const cors = require('cors');
const multer = require('multer');
const app = express();

// 配置CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true
}));

app.use(express.json());

// 配置multer
const upload = multer({ dest: 'uploads/' });

// 测试端点
app.get('/api/test', (req, res) => {
    console.log('🟢 收到GET请求 /api/test');
    res.json({ 
        message: '后端连接成功！', 
        timestamp: new Date().toISOString(),
        port: 3001
    });
});

// 文件上传测试端点
app.post('/api/quotations/import', upload.single('file'), (req, res) => {
    console.log('🔵 收到POST请求', req.path);
    console.log('📊 请求头:', req.headers);
    
    if (req.file) {
        // 修复中文文件名编码
        let fileName = req.file.originalname;
        try {
            // 尝试修复中文编码
            fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        } catch (e) {
            // 如果转换失败，使用原始文件名
            fileName = req.file.originalname;
        }
        
        console.log('📁 上传的文件:', fileName);
        console.log('📊 文件信息:', {
            originalName: req.file.originalname,
            fixedName: fileName,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
        console.log('✅ 文件上传成功:', fileName);
        res.json({ message: '文件上传成功', fileName: fileName });
    } else {
        console.log('📁 上传的文件: 无文件');
        res.status(400).json({ error: '没有文件被上传' });
    }
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log('\n🚀 调试服务器启动成功！');
    console.log(`📡 端口: ${PORT}`);
    console.log(`🔗 测试URL: http://localhost:${PORT}/api/test`);
    console.log(`📤 上传端点: http://localhost:${PORT}/api/quotations/import`);
    console.log('�� 等待请求...\n');
}); 