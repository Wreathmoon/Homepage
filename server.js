const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const xlsx = require('xlsx');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// 初始化Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyBie3GiTRzEnNrrj-kne9NNXwvgqnkgt5A');

const app = express();
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// MongoDB连接
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation_system';

mongoose.connect(mongoUri)
    .then(() => {
        console.log('✅ AI服务器MongoDB连接成功');
        console.log('📦 数据库:', mongoUri);
    })
    .catch(err => {
        console.error('❌ AI服务器MongoDB连接失败:', err);
        process.exit(1);
    });

// MongoDB模型定义
const QuotationSchema = new mongoose.Schema({
    // 基本产品信息
    name: {
        type: String,
        required: true,
        trim: true
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    supplier: {
        type: String,
        required: true,
        trim: true
    },
    
    // 价格信息
    list_price: {
        type: Number,
        min: 0
    },
    quote_unit_price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    discount_rate: {
        type: Number,
        min: 0,
        max: 100
    },
    quote_total_price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        default: 'EUR',
        enum: ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'AUD', 'CAD', 'SGD', 'CHF', 'RUB', 'INR', 'KRW', 'THB', 'MYR', 'TWD', 'VND', 'IDR', 'BRL', 'ZAR', 'MXN', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'HUF', 'CZK', 'TRY', 'SAR', 'AED', 'ILS']
    },
    
    // 时间信息
    quote_validity: {
        type: Date,
        required: true
    },
    delivery_date: {
        type: Date
    },
    
    // 详细信息
    notes: {
        type: String,
        trim: true
    },
    configDetail: {
        type: String,
        trim: true
    },
    productSpec: {
        type: String,
        trim: true
    },
    
    // 客户信息
    endUser: {
        name: String,
        address: String,
        contact: String,
        contactInfo: String
    },
    
    // 附件信息
    attachments: [{
        id: String,
        name: String,
        originalName: String, 
        filename: String,
        path: String,
        size: Number,
        mimetype: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // 分类和标签
    category: {
        type: String,
        enum: ['服务器', '存储设备', '网络设备', '安全设备', '软件系统', '云服务', '其他']
    },
    region: {
        type: String,
        enum: ['德国', '法国', '英国', '意大利', '西班牙', '荷兰', '比利时', '瑞士', '奥地利', '瑞典', '挪威', '丹麦', '芬兰', '波兰', '捷克', '匈牙利', '葡萄牙', '爱尔兰', '希腊', '美国', '加拿大', '其他']
    },
    
    // 状态信息
    status: {
        type: String,
        enum: ['active', 'expired', 'pending', 'cancelled'],
        default: 'active'
    },
    
    // 原始文件信息
    originalFile: {
        filename: String,
        originalName: String,
        path: String,
        uploadedAt: Date
    },
    
    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Quotation = mongoose.model('Quotation', QuotationSchema);

// 创建uploads目录
const createUploadsDir = async () => {
    try {
        await fs.mkdir('./uploads/', { recursive: true });
        console.log('📁 uploads目录已创建');
    } catch (error) {
        console.error('❌ 创建uploads目录失败:', error);
    }
};
createUploadsDir();

// 设置存储配置
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = './uploads/';
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            console.error('❌ 创建上传目录失败:', error);
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, `${timestamp}-${originalName}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

console.log('🚀 正在启动AI报价分析服务器...');

// API 1: 仅上传文件，不进行处理
app.post('/api/quotations/upload', upload.single('file'), async (req, res) => {
    console.log('📤 收到文件上传请求');
    
    if (!req.file) {
        return res.status(400).json({ error: '没有文件被上传' });
    }

    // 修复中文文件名编码
    let fileName = req.file.originalname;
    try {
        fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    } catch (e) {
        fileName = req.file.originalname;
    }
    
    console.log(`📁 文件上传成功: ${fileName}`); 
    console.log(`📂 文件路径: ${req.file.path}`);
    
    // 返回文件信息，供后续分析使用
    res.json({
        message: '文件上传成功！',
        fileInfo: {
            fileName: fileName,
            filePath: req.file.path,
            originalName: req.file.originalname,
            size: req.file.size,
            uploadTime: new Date().toISOString()
        }
    });
});

// API 2: 分析已上传的文件并保存到MongoDB
app.post('/api/quotations/analyze', async (req, res) => {
    console.log('🔍 收到文件分析请求');
    const { filePath, fileName } = req.body;
    
    if (!filePath || !fileName) {
        return res.status(400).json({ error: '缺少文件路径或文件名' });
    }

    console.log(`📁 开始分析文件: ${fileName}`); 
    console.log(`📂 文件路径: ${filePath}`);
    
    const fileExtension = fileName.split('.').pop().toLowerCase();
    let extractedText = '';

    try {
        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: '文件不存在或已过期' });
        }

        // 根据文件类型提取文本
        if (fileExtension === 'pdf') {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdf(dataBuffer);
            extractedText = data.text;
        } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            extractedText = xlsx.utils.sheet_to_txt(worksheet);
        } else if (fileExtension === 'docx') {
            const dataBuffer = await fs.readFile(filePath);
            const result = await mammoth.extractRawText({ arrayBuffer: dataBuffer });
            extractedText = result.value;
        } else {
            return res.status(400).json({ error: '不支持的文件格式。目前支持PDF、Excel和Word (.docx) 文件。' });
        }

        console.log('📄 文本提取完成 (前500字符):\n', extractedText.substring(0, 500) + '...');

        // 调用Gemini AI进行分析
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash"});
        
        const prompt = `从以下报价文本中提取产品信息。以 JSON 数组的形式返回，每个产品一个对象。每个对象应包含以下字段：
        产品名称 (productName) - 必填，字符串。如果识别到文本描述的是服务器配件明细、"主机"或具体的服务器型号（如"PowerEdge R7625"），请不要展示各个配件信息，而是将其识别为一个服务器产品，产品名可以概括为"XX型号服务器报价"（例如："PowerEdge R7625 服务器报价"）。
        供应商 (vendor) - 必填，字符串。如果报价文本中没有明确的供应商名称，请尝试从文件名的括号中提取（例如：文件名"报价单（天耘）.pdf"中的"天耘"）。
        产品类别 (category) - 必填，字符串。请从以下选项中选择最合适的：服务器、存储设备、网络设备、安全设备、软件系统、云服务、其他。
        地区 (region) - 可选，字符串。请从以下选项中选择：德国、法国、英国、意大利、西班牙、荷兰、比利时、瑞士、奥地利、瑞典、挪威、丹麦、芬兰、波兰、捷克、匈牙利、葡萄牙、爱尔兰、希腊、美国、加拿大、其他。如果无法确定请设为null。
        产品规格 (productSpec) - 可选，字符串。产品的简要规格描述，例如"48口千兆交换机，4个10G上联口"。
        原始单价 (originalPrice) - 可选，数字。折扣前的单价。
        最终单价 (finalPrice) - 必填，数字。到手价/报价单价。对于服务器产品，请提供服务器整体的单价。
        数量 (quantity) - 必填，整数。对于服务器产品，请提供服务器的整体数量。
        折扣率 (discount) - 可选，数字。折扣率，例如0.9表示9折。
        报价日期 (quotationDate) - 必填，字符串 (日期格式，如YYYY-MM-DD)。
        备注 (remark) - 可选，字符串。如果项目是服务器，请将服务器的所有详细配置信息（例如处理器、内存、硬盘、RAID卡、网卡、电源等）整合并总结到此字段。对于非服务器产品，此字段可以为空。

        请注意：如果报价中同一台服务器的各个配件单独列出价格，请不要将每个配件作为单独的记录插入数据库。而是将这些配件的信息整合到该服务器记录的"备注"字段中，并确保该服务器只生成一条记录，其价格和数量反映服务器的整体信息。

        如果无法识别某个必填字段，请将整个产品对象省略。如果可选字段无法识别，请将其设置为 null。如果无法提取任何产品，请返回一个空数组。
        
        报价文本：
        ${extractedText}`;

        console.log('🤖 发送prompt给Gemini进行分析...');

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('🤖 Gemini分析完成，响应长度:', text.length);

        // 解析AI返回的JSON
        let parsedProducts = [];
        try {
            const jsonStartIndex = text.indexOf('[');
            const jsonEndIndex = text.lastIndexOf(']') + 1;
            if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
                const jsonString = text.substring(jsonStartIndex, jsonEndIndex);
                parsedProducts = JSON.parse(jsonString);
                console.log('✅ 成功解析产品数据，数量:', parsedProducts.length);
            } else {
                console.warn("❌ Gemini返回的JSON格式不正确:", text);
                return res.status(500).json({ error: '大模型返回格式不正确，无法解析产品数据。' });
            }
        } catch (jsonError) {
            console.error('❌ JSON解析错误:', jsonError);
            return res.status(500).json({ error: '解析大模型响应时发生错误。' });
        }

        // 数据验证和格式转换
        const validatedProducts = parsedProducts.filter(p => 
            typeof p === 'object' && p !== null &&
            p.productName && typeof p.productName === 'string' &&
            p.vendor && typeof p.vendor === 'string' &&
            p.category && typeof p.category === 'string' &&
            p.finalPrice !== undefined && typeof p.finalPrice === 'number' &&
            p.quantity !== undefined && typeof p.quantity === 'number' &&
            p.quotationDate && typeof p.quotationDate === 'string'
        ).map(p => {
            // 从文件名提取供应商（如果AI未识别）
            let finalSupplier = p.vendor;
            if (!p.vendor && fileName) {
                const match = fileName.match(/\((.*?)\)/);
                if (match && match[1]) {
                    finalSupplier = match[1];
                }
            }

            // 转换为MongoDB格式
            return {
                name: p.productName, // 必填字段
                productName: p.productName,
                supplier: finalSupplier,
                category: p.category,
                region: p.region && ['德国', '法国', '英国', '意大利', '西班牙', '荷兰', '比利时', '瑞士', '奥地利', '瑞典', '挪威', '丹麦', '芬兰', '波兰', '捷克', '匈牙利', '葡萄牙', '爱尔兰', '希腊', '美国', '加拿大', '其他'].includes(p.region) ? p.region : null,
                productSpec: p.productSpec || null,
                configDetail: p.productSpec || null,
                list_price: p.originalPrice || null,
                quote_unit_price: p.finalPrice,
                quantity: p.quantity,
                discount_rate: p.discount ? p.discount * 100 : null,
                quote_total_price: p.finalPrice * p.quantity,
                quote_validity: new Date(p.quotationDate),
                currency: 'EUR',
                notes: p.remark || null,
                status: 'active',
                originalFile: {
                    filename: path.basename(filePath),
                    originalName: fileName,
                    path: filePath,
                    uploadedAt: new Date()
                }
            };
        });

        console.log('💾 准备保存到MongoDB的产品数量:', validatedProducts.length);

        if (validatedProducts.length === 0) {
            return res.status(200).json({ message: '文件分析完成，但未识别到有效产品数据。' });
        }

        // 保存到MongoDB
        const savedQuotations = [];
        for (const productData of validatedProducts) {
            try {
                const quotation = new Quotation(productData);
                const saved = await quotation.save();
                savedQuotations.push(saved);
                console.log(`✅ 成功保存到MongoDB: ${productData.productName} (ID: ${saved._id})`);
            } catch (error) {
                console.error(`❌ 保存失败: ${productData.productName}`, error.message);
                // 继续处理其他产品
            }
        }

        res.json({ 
            message: '文件分析完成！', 
            data: savedQuotations,
            fileInfo: {
                fileName: fileName,
                processedCount: savedQuotations.length,
                totalCount: validatedProducts.length
            }
        });

    } catch (error) {
        console.error('❌ 文件分析失败:', error);
        
        let errorMessage = '文件分析失败';
        if (error.name === 'GoogleGenerativeAIFetchError') {
            errorMessage = `大模型错误：${error.message}`;
        }

        res.status(500).json({ error: errorMessage });
    }
});

// API 3: 下载原始文件
app.get('/api/quotations/download/:id', async (req, res) => {
    const quotationId = req.params.id;
    
    try {
        const quotation = await Quotation.findById(quotationId);
        
        if (!quotation || !quotation.originalFile || !quotation.originalFile.path) {
            return res.status(404).json({ error: '找不到原始文件' });
        }
        
        const filePath = quotation.originalFile.path;
        const productName = quotation.productName || 'quotation';
        
        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ error: '原始文件不存在或已被删除' });
        }
        
        // 获取文件扩展名
        const fileExtension = filePath.split('.').pop();
        const downloadFileName = `${productName}.${fileExtension}`;
        
        console.log(`📤 开始下载文件: ${downloadFileName}`);
        
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        const fileStream = require('fs').createReadStream(filePath);
        fileStream.pipe(res);
        
        fileStream.on('error', (error) => {
            console.error('❌ 文件读取错误:', error);
            res.status(500).json({ error: '文件读取失败' });
        });
    } catch (error) {
        console.error('❌ 查询报价记录失败:', error);
        res.status(500).json({ error: '查询失败' });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 AI报价分析服务器启动成功！`);
    console.log(`📡 端口: ${PORT}`);
    console.log(`🔗 访问地址: http://localhost:${PORT}`);
    console.log(`📤 文件上传端点: http://localhost:${PORT}/api/quotations/upload`);
    console.log(`🤖 AI分析端点: http://localhost:${PORT}/api/quotations/analyze`);
    console.log(`📥 文件下载端点: http://localhost:${PORT}/api/quotations/download/:id`);
});