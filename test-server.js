const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());

app.get('/api/test', (req, res) => {
    res.json({ message: '后端服务器运行正常！', timestamp: new Date().toISOString() });
});

app.post('/api/quotations/import', (req, res) => {
    res.json({ message: '测试成功！文件上传端点可用', data: [] });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 测试服务器运行在 http://localhost:${PORT}`);
    console.log(`📡 前端地址: http://localhost:3000`);
    console.log(`🔗 API端点: http://localhost:${PORT}/api/test`);
}); 