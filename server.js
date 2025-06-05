const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const Quotation = require('./src/models/quotation');

const app = express();
const port = 3001;

// 配置 MongoDB 连接
mongoose.connect('mongodb://localhost:27017/quotation_helper')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// 配置 multer 存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// 配置 CORS
app.use(cors());
app.use(express.json());

// 配置 Google Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || 'your-api-key');

// 数据库管理接口
// 1. 获取数据库统计信息
app.get('/api/db/stats', async (req, res) => {
    try {
        const stats = {
            totalQuotations: await Quotation.countDocuments(),
            supplierStats: await Quotation.aggregate([
                { $group: { _id: "$supplier", count: { $sum: 1 } } }
            ]),
            recentQuotations: await Quotation.find()
                .sort({ created_at: -1 })
                .limit(5)
                .select('name supplier quote_total_price created_at')
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. 批量操作接口
app.post('/api/db/bulk', async (req, res) => {
    const { operation, items } = req.body;
    try {
        let result;
        switch (operation) {
            case 'insert':
                result = await Quotation.insertMany(items);
                break;
            case 'update':
                result = await Promise.all(
                    items.map(item => 
                        Quotation.findByIdAndUpdate(item._id, item, { new: true })
                    )
                );
                break;
            case 'delete':
                result = await Quotation.deleteMany({ _id: { $in: items } });
                break;
            default:
                throw new Error('Invalid operation');
        }
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. 高级查询接口
app.post('/api/db/query', async (req, res) => {
    const { filter, sort, limit = 10, skip = 0 } = req.body;
    try {
        const query = Quotation.find(filter);
        if (sort) query.sort(sort);
        const total = await Quotation.countDocuments(filter);
        const data = await query.skip(skip).limit(limit);
        res.json({ data, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 处理文件上传和解析
app.post('/api/upload-quotation', upload.single('quotationFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有上传文件' });
    }

    try {
        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // 使用 Gemini API 解析文件内容
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `请解析以下报价文件内容，提取产品名称、供应商、List Price、报价单价、数量、折扣率等信息：\n\n${fileContent}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsedData = JSON.parse(response.text());

        // 将解析结果保存到数据库
        const savedQuotations = await Quotation.insertMany(parsedData);

        // 清理上传的文件
        fs.unlinkSync(filePath);

        res.json({
            message: '文件解析成功',
            data: savedQuotations
        });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ error: '文件处理失败' });
    }
});

// 获取所有报价记录
app.get('/api/products', async (req, res) => {
    try {
        const quotations = await Quotation.find().sort({ created_at: -1 });
        res.json(quotations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个报价记录
app.get('/api/products/:id', async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        if (!quotation) {
            return res.status(404).json({ error: '记录不存在' });
        }
        res.json(quotation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新报价记录
app.put('/api/products/:id', async (req, res) => {
    try {
        const quotation = await Quotation.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!quotation) {
            return res.status(404).json({ error: '记录不存在' });
        }
        res.json(quotation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除报价记录
app.delete('/api/products/:id', async (req, res) => {
    try {
        const quotation = await Quotation.findByIdAndDelete(req.params.id);
        if (!quotation) {
            return res.status(404).json({ error: '记录不存在' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 