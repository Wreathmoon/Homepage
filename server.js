require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const crypto = require('crypto'); // 添加crypto模块用于计算文件hash
const bodyParser = require('body-parser');
// 替换Google Gemini AI为axios，用于调用元景大模型API
const axios = require('axios');
const xlsx = require('xlsx');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// 初始化元景大模型配置
const YUANJING_CONFIG = {
    apiKey: process.env.YUANJING_API_KEY || 'sk-59454f95d79b4d5d9ad8d5d9d6237bc1',
    model: process.env.YUANJING_MODEL || 'yuanjing-70b-chat',
    baseUrl: process.env.YUANJING_API_ENDPOINT || 'https://maas-api.ai-yuanjing.com/openapi/compatible-mode/v1'
};

// 元景AI调用函数
async function callYuanJingAI(prompt) {
    console.log('🤖 正在调用元景70B大模型...');
    
    try {
        const startTime = Date.now();
        
        const response = await axios.post(
            `${YUANJING_CONFIG.baseUrl}/chat/completions`,
            {
                model: YUANJING_CONFIG.model,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 4000,
                top_p: 0.9,
                stream: false
            },
            {
                headers: {
                    'Authorization': `Bearer ${YUANJING_CONFIG.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 180000 // 3分钟超时
            }
        );

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ 元景70B模型调用成功！耗时: ${duration}ms`);
        
        // 安全地提取响应内容
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const content = response.data.choices[0].message.content;
            if (content && content.trim()) {
                return content;
            } else {
                throw new Error('AI返回内容为空');
            }
        } else {
            throw new Error('AI响应格式异常，未找到choices');
        }
        
    } catch (error) {
        console.error('❌ 元景70B模型调用失败:', {
            status: error.response?.status,
            message: error.message,
            code: error.code
        });
        
        // 详细的错误分类和处理
        if (error.code === 'ECONNABORTED') {
            throw new Error('AI调用超时，请稍后重试');
        } else if (error.response?.status === 422) {
            throw new Error(`AI调用参数错误: ${error.response.data?.msg || 'Unavailable'}`);
        } else if (error.response?.status === 401) {
            throw new Error('AI API密钥无效或已过期');
        } else if (error.response?.status === 429) {
            throw new Error('AI调用频率超限，请稍后重试');
        } else if (error.response?.status >= 500) {
            throw new Error(`AI服务器内部错误，请稍后重试`);
        } else {
            throw new Error(`AI调用失败: ${error.message}`);
        }
    }
}

// 计算文件MD5 hash
const calculateFileHash = async (filePath) => {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
};

// 检测重复上传
const checkDuplicates = async (filePath, fileName, validatedProducts) => {
    const duplicates = {
        fileHash: null,
        existingFile: null,
        productDuplicates: []
    };

    try {
        // 1. 计算文件hash
        const fileHash = await calculateFileHash(filePath);
        duplicates.fileHash = fileHash;

        // 2. 检查是否有相同hash的文件已上传
        const existingFileRecord = await Quotation.findOne({
            'originalFile.fileHash': fileHash
        });

        if (existingFileRecord) {
            duplicates.existingFile = {
                id: existingFileRecord._id,
                fileName: existingFileRecord.originalFile.originalName,
                uploadDate: existingFileRecord.originalFile.uploadedAt,
                productName: existingFileRecord.productName
            };
        }

        // 3. 检查产品信息重复
        for (const product of validatedProducts) {
            // 查找相似的产品记录
            const similarProducts = await Quotation.find({
                productName: { $regex: product.productName, $options: 'i' },
                supplier: product.supplier,
                quote_unit_price: product.quote_unit_price,
                quantity: product.quantity
            });

            if (similarProducts.length > 0) {
                duplicates.productDuplicates.push({
                    newProduct: product,
                    existingProducts: similarProducts.map(p => ({
                        id: p._id,
                        productName: p.productName,
                        supplier: p.supplier,
                        unitPrice: p.quote_unit_price,
                        quantity: p.quantity,
                        uploadDate: p.createdAt,
                        originalFileName: p.originalFile?.originalName
                    }))
                });
            }
        }

        return duplicates;
    } catch (error) {
        console.error('❌ 重复检测失败:', error);
        return duplicates;
    }
};

const app = express();

// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: process.env.UPLOAD_LIMIT || '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: process.env.UPLOAD_LIMIT || '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'build')));

// 数据库连接 - 提供默认本地MongoDB配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation_db';

console.log('🔗 尝试连接MongoDB:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB连接成功'))
  .catch(err => {
    console.error('❌ MongoDB连接失败:', err.message);
    console.log('💡 请确保MongoDB服务正在运行，或者设置MONGODB_URI环境变量');
    console.log('💡 如果没有MongoDB，可以使用MongoDB Atlas云服务或本地安装MongoDB');
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
        enum: ['美国', '中国', '韩国', '日本', '芬兰', '瑞典', '荷兰', '德国', '法国', '印度', '以色列', '加拿大', '澳大利亚', '台湾', '英国', '瑞士', '新加坡', '其他']
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
        fileSize: Number,
        mimetype: String,
        fileHash: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },
    
    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Quotation = mongoose.model('Quotation', QuotationSchema);

// Vendor模型定义
const VendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    category: [{
        type: String,
        enum: ['服务器', '存储设备', '网络设备', '安全设备', '软件系统', '云服务', '其他']
    }],
    region: {
        type: String,
        enum: ['美国', '中国', '韩国', '日本', '芬兰', '瑞典', '荷兰', '德国', '法国', '印度', '以色列', '加拿大', '澳大利亚', '台湾', '英国', '瑞士', '新加坡', '其他']
    },
    contact: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    address: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    level: {
        type: String,
        enum: ['A', 'B', 'C'],
        default: 'B'
    },
    remarks: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['HARDWARE', 'SOFTWARE', 'SERVICE'],
        required: true
    },
    country: {
        type: String,
        required: true,
        trim: true
    },
    website: {
        type: String,
        trim: true
    },
    brands: [{
        type: String,
        trim: true
    }],
    isGeneralAgent: {
        type: Boolean,
        default: false
    },
    isAgent: {
        type: Boolean,
        default: false
    },
    account: {
        type: String,
        trim: true
    },
    password: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// 创建索引
VendorSchema.index({ name: 1 });
VendorSchema.index({ country: 1 });
VendorSchema.index({ type: 1 });
VendorSchema.index({ category: 1 });
VendorSchema.index({ brands: 1 });

const Vendor = mongoose.model('Vendor', VendorSchema);

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

// API 2: 分析已上传的文件
app.post('/api/quotations/analyze', async (req, res) => {
    const { fileName, filePath } = req.body;
    
    if (!fileName || !filePath) {
        return res.status(400).json({ error: '缺少文件信息' });
    }

    try {
        console.log(`📊 开始分析文件: ${fileName}`);
        
        // 计算文件hash
        const fileHash = await calculateFileHash(filePath);
        
        // 检查是否有相同hash的文件已分析过
        const existingFileRecord = await Quotation.findOne({
            'originalFile.fileHash': fileHash
        });
        
        if (existingFileRecord) {
            return res.json({
                success: true,
                isDuplicate: true,
                duplicateType: 'file',
                existingRecord: {
                    id: existingFileRecord._id,
                    fileName: existingFileRecord.originalFile.originalName,
                    productName: existingFileRecord.productName,
                    uploadDate: existingFileRecord.originalFile.uploadedAt,
                    supplier: existingFileRecord.supplier
                },
                message: '检测到相同文件已上传过，是否要继续处理？'
            });
        }
        
        // 读取文件内容
        let content;
        const fullPath = path.resolve(filePath);
        
        if (fileName.toLowerCase().includes('.xlsx') || fileName.toLowerCase().includes('.xls')) {
            const workbook = xlsx.readFile(fullPath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            content = xlsx.utils.sheet_to_csv(worksheet);
        } else if (fileName.toLowerCase().includes('.pdf')) {
            const dataBuffer = await fs.readFile(fullPath);
            const data = await pdf(dataBuffer);
            content = data.text;
        } else if (fileName.toLowerCase().includes('.docx') || fileName.toLowerCase().includes('.doc')) {
            const result = await mammoth.extractRawText({ path: fullPath });
            content = result.value;
        } else {
            content = await fs.readFile(fullPath, 'utf8');
        }

        console.log('🤖 开始AI分析...');
        
        const prompt = `你是一个专业的报价单分析专家。请仔细分析以下报价文件内容，提取真实的产品报价信息。

重要提示：
1. 忽略表头、标题、公司信息、联系方式等非产品信息
2. 只提取实际的产品/设备/服务的报价记录
3. 如果某一行看起来像表头、说明文字或格式化文本，请跳过
4. 供应商信息优先从文件头部、公司信息、签章处获取，而不是产品行中的品牌名

请以JSON数组格式返回，每个产品对象包含以下字段：

产品基本信息：
- productName: 产品的具体名称（如"戴尔PowerEdge R750服务器"、"思科Catalyst 9300交换机"等，避免提取"FACTORY INTEGRATED"、"ITEM"、"产品"等通用词汇）
- supplier: 供应商/经销商名称（从文档抬头、公司信息或签名处获取，不是产品品牌）
- region: 地区（美国、中国、韩国、日本、芬兰、瑞典、荷兰、德国、法国、印度、以色列、加拿大、澳大利亚、台湾、英国、瑞士、新加坡、其他）
- product_category: 产品类别（服务器、存储设备、网络设备、安全设备、软件系统、云服务、其他）

价格信息：
- list_price: 列表价格/原价（如果有）
- quote_unit_price: 实际报价单价（必填，数字）
- quantity: 数量（必填，大于0的整数）
- discount_rate: 折扣率（0-100之间的数字，如10表示10%折扣）
- quote_total_price: 报价总价（单价×数量）
- currency: 货币（CNY/USD/EUR等）

时间和备注：
- quote_validity: 报价有效期（YYYY-MM-DD格式）
- delivery_date: 交付日期（如果有）
- notes: 备注信息
- configDetail: 产品配置详情
- productSpec: 产品规格描述

数据质量要求：
- productName不能是"FACTORY"、"INTEGRATED"、"ITEM"、"产品"、"设备"等通用词
- supplier不能是产品品牌（如"HPE"、"DELL"、"Cisco"），应该是经销商/供应商公司名
- 如果无法识别有效的产品名称，请跳过该条记录
- 如果价格为0或无法识别，请跳过该条记录

请直接返回JSON数组，不要包含其他解释文字。

文件内容：
${content}`;

        const result = await callYuanJingAI(prompt);
        let text = result;
        
        console.log('🤖 AI原始回复:', text);
        
        // 清理响应文本
        text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        let parsedData;
        try {
            parsedData = JSON.parse(text);
        } catch (parseError) {
            console.error('❌ JSON解析失败:', parseError);
            return res.status(500).json({ 
                error: 'AI返回的JSON格式不正确',
                rawResponse: text
            });
        }

        // 确保返回的是数组
        let products = Array.isArray(parsedData) ? parsedData : [parsedData];
        
        // 验证和标准化数据
        const validatedProducts = products.map(product => {
            // 价格字段清理函数
            const cleanPrice = (value) => {
                if (value === null || value === undefined) return null;
                if (typeof value === 'string') {
                    const cleanedValue = value.toString().replace(/[,\s]/g, '');
                    const numValue = parseFloat(cleanedValue);
                    return isNaN(numValue) ? null : numValue;
                }
                return typeof value === 'number' ? value : null;
            };
            
            // 清理数量字段
            const cleanQuantity = (value) => {
                if (value === null || value === undefined) return 1;
                if (typeof value === 'string') {
                    const cleanedValue = value.toString().replace(/[,\s]/g, '');
                    const numValue = parseInt(cleanedValue);
                    return isNaN(numValue) ? 1 : Math.max(1, numValue);
                }
                return typeof value === 'number' ? Math.max(1, Math.floor(value)) : 1;
            };
            
            const listPrice = cleanPrice(product.list_price);
            const unitPrice = cleanPrice(product.quote_unit_price) || 0;
            const quantity = cleanQuantity(product.quantity);
            const discountRate = cleanPrice(product.discount_rate);
            const totalPrice = cleanPrice(product.quote_total_price) || (unitPrice * quantity);
            
            // 获取文件信息
            let fileSize = 0;
            let mimeType = 'application/octet-stream';
            
            try {
                const stats = require('fs').statSync(filePath);
                fileSize = stats.size;
            } catch (error) {
                console.warn('⚠️ 无法获取文件大小:', error.message);
            }
            
            // 根据文件扩展名确定MIME类型
            const ext = fileName.toLowerCase().split('.').pop();
            const mimeTypes = {
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'xls': 'application/vnd.ms-excel',
                'pdf': 'application/pdf',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'doc': 'application/msword',
                'csv': 'text/csv',
                'txt': 'text/plain'
            };
            mimeType = mimeTypes[ext] || 'application/octet-stream';
            
            console.log(`🔧 正在为产品 "${product.productName}" 构建originalFile:`, {
                fileName,
                filePath,
                fileSize,
                mimeType,
                fileHash
            });
            
            const validated = {
                name: product.productName || '未知产品',
                productName: product.productName || '未知产品',
                supplier: product.supplier || '未知供应商',
                region: product.region || '其他',
                product_category: product.product_category || '其他',
                list_price: listPrice,
                quote_unit_price: unitPrice,
                quantity: quantity,
                discount_rate: discountRate,
                quote_total_price: totalPrice,
                currency: product.currency || 'EUR',
                quote_validity: product.quote_validity ? new Date(product.quote_validity) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                delivery_date: product.delivery_date ? new Date(product.delivery_date) : null,
                notes: product.notes || '',
                configDetail: product.configDetail || '',
                productSpec: product.productSpec || '',
                category: product.product_category || '其他',
                status: 'active',
                originalFile: {
                    filename: fileName,
                    originalName: fileName,
                    path: filePath,
                    fileSize: fileSize,
                    mimetype: mimeType,
                    fileHash: fileHash,
                    uploadedAt: new Date()
                }
            };
            
            return validated;
        });

        console.log(`✅ 数据验证完成，产品数量: ${validatedProducts.length}`);
        
        // 🔍 检测重复
        console.log('🔍 开始检测重复...');
        const duplicates = await checkDuplicates(filePath, fileName, validatedProducts);
        
        // 如果检测到重复，返回重复信息供用户选择
        if (duplicates.existingFile || duplicates.productDuplicates.length > 0) {
            console.log('⚠️ 检测到重复内容');
            return res.json({
                success: true,
                isDuplicate: true,
                duplicateInfo: duplicates,
                validatedProducts: validatedProducts,
                fileInfo: {
                    fileName: fileName,
                    filePath: filePath,
                    fileHash: fileHash
                },
                message: '检测到重复内容，请选择处理方式'
            });
        }
        
        // 没有重复，直接返回分析结果
        console.log('✅ 无重复内容，分析完成');
        res.json({
            success: true,
            isDuplicate: false,
            products: validatedProducts,
            message: `成功分析 ${validatedProducts.length} 个产品`
        });
        
    } catch (error) {
        console.error('❌ 分析文件失败:', error);
        res.status(500).json({ 
            error: '文件分析失败',
            details: error.message 
        });
    }
});

// API: 查询历史报价列表
app.get('/api/quotations/list', async (req, res) => {
    console.log('📋 收到历史报价查询请求');
    
    try {
        const {
            page = 1,
            pageSize = 10,
            supplier,
            productName,
            category,
            region,
            currency,
            status,
            startDate,
            endDate,
            keyword
        } = req.query;

        // 构建查询条件
        const filter = {};
        
        if (supplier) {
            filter.supplier = { $regex: supplier, $options: 'i' };
        }
        
        if (productName) {
            filter.productName = { $regex: productName, $options: 'i' };
        }
        
        if (category) {
            filter.category = category;
        }
        
        if (region) {
            filter.region = region;
        }
        
        if (currency) {
            filter.currency = currency;
        }
        
        if (status) {
            filter.status = status;
        }
        
        if (startDate || endDate) {
            filter.created_at = {};
            if (startDate) {
                filter.created_at.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.created_at.$lte = new Date(endDate + 'T23:59:59.999Z');
            }
        }
        
        if (keyword) {
            filter.$or = [
                { productName: { $regex: keyword, $options: 'i' } },
                { supplier: { $regex: keyword, $options: 'i' } },
                { notes: { $regex: keyword, $options: 'i' } },
                { configDetail: { $regex: keyword, $options: 'i' } }
            ];
        }

        console.log('🔍 查询条件:', JSON.stringify(filter, null, 2));

        // 计算分页
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        
        // 执行查询
        const [data, total] = await Promise.all([
            Quotation.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(parseInt(pageSize))
                .lean(),
            Quotation.countDocuments(filter)
        ]);

        console.log(`📊 查询结果: ${data.length} 条记录，总计 ${total} 条`);

        res.json({
            success: true,
            data: data,
            total: total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize))
        });

    } catch (error) {
        console.error('❌ 查询历史报价失败:', error);
        res.status(500).json({ 
            error: '查询失败',
            details: error.message 
        });
    }
});

// API: 获取单个报价详情
app.get('/api/quotations/detail/:id', async (req, res) => {
    const quotationId = req.params.id;
    
    console.log(`📋 收到单个报价查询请求，ID: ${quotationId}`);
    
    try {
        const quotation = await Quotation.findById(quotationId).lean();
        
        if (!quotation) {
            console.log('❌ 未找到对应的报价记录');
            return res.status(404).json({ error: '找不到报价记录' });
        }
        
        console.log(`✅ 找到报价记录: ${quotation.productName}`);
        
        res.json({
            success: true,
            data: quotation
        });
        
    } catch (error) {
        console.error('❌ 查询报价详情失败:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: '无效的记录ID格式' });
        }
        res.status(500).json({ 
            error: '查询失败',
            details: error.message 
        });
    }
});

// API: 下载原始文件
app.get('/api/quotations/download/:id', async (req, res) => {
    const quotationId = req.params.id;
    
    console.log(`📥 收到下载请求，ID: ${quotationId}`);
    
    try {
        console.log('🔍 开始查询数据库...');
        const quotation = await Quotation.findById(quotationId);
        
        console.log(`📋 查询结果: ${quotation ? '找到记录' : '未找到记录'}`);
        
        if (!quotation) {
            console.log('❌ 数据库中没有找到对应记录');
            return res.status(404).json({ error: '找不到报价记录' });
        }
        
        console.log(`📋 查询结果: ${quotation ? '找到记录' : '未找到记录'}`);
        
        if (!quotation.originalFile) {
            console.log('❌ 记录没有原始文件信息');
            return res.status(404).json({ 
                error: '该记录没有关联的原始文件',
                reason: 'missing_original_file',
                suggestion: '此记录可能是手动添加的，或者在文件信息保存时出现了问题'
            });
        }
        
        const filePath = quotation.originalFile.path;
        const originalFileName = quotation.originalFile.originalName || quotation.originalFile.filename;
        const storedMimeType = quotation.originalFile.mimetype;
        
        console.log(`📂 文件路径: ${filePath}`);
        console.log(`📝 原始文件名: ${originalFileName}`);
        console.log(`🎭 MIME类型: ${storedMimeType}`);
        
        if (!filePath) {
            console.log('❌ 原始文件路径为空');
            return res.status(404).json({ 
                error: '原始文件路径不存在',
                reason: 'empty_file_path',
                suggestion: '文件路径信息丢失，可能是数据保存时出现了问题'
            });
        }
        
        // 检查文件是否存在
        console.log('🔍 检查文件是否存在...');
        try {
            await fs.access(filePath);
            console.log('✅ 文件存在');
        } catch (fileError) {
            console.log(`❌ 文件不存在: ${fileError.message}`);
            console.log(`🔍 检查的路径: ${filePath}`);
            return res.status(404).json({ error: '原始文件不存在或已被删除' });
        }
        
        // 确定MIME类型
        let mimeType = storedMimeType || 'application/octet-stream';
        
        // 根据文件扩展名确定MIME类型（如果数据库中没有存储）
        if (!storedMimeType || storedMimeType === 'application/octet-stream') {
            const ext = originalFileName ? originalFileName.toLowerCase().split('.').pop() : 
                        filePath.toLowerCase().split('.').pop();
            
            const mimeTypes = {
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'xls': 'application/vnd.ms-excel',
                'pdf': 'application/pdf',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'doc': 'application/msword',
                'csv': 'text/csv',
                'txt': 'text/plain'
            };
            
            mimeType = mimeTypes[ext] || 'application/octet-stream';
        }
        
        // 使用原始文件名或生成合适的文件名
        let downloadFileName = originalFileName;
        if (!downloadFileName) {
            const productName = quotation.productName || 'quotation';
            const fileExtension = filePath.split('.').pop();
            downloadFileName = `${productName}.${fileExtension}`;
        }
        
        console.log(`📤 开始下载文件: ${downloadFileName} (MIME: ${mimeType})`);
        console.log(`📂 文件路径: ${filePath}`);
        
        // 设置正确的响应头
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`);
        
        // 可选：添加文件大小信息
        if (quotation.originalFile.fileSize) {
            res.setHeader('Content-Length', quotation.originalFile.fileSize);
        }
        
        const fileStream = require('fs').createReadStream(filePath);
        fileStream.pipe(res);
        
        fileStream.on('error', (error) => {
            console.error('❌ 文件读取错误:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: '文件读取失败' });
            }
        });
        
        fileStream.on('end', () => {
            console.log('✅ 文件下载完成');
        });
        
    } catch (error) {
        console.error('❌ 查询报价记录失败:', error);
        if (error.name === 'CastError') {
            console.log('❌ 无效的MongoDB ObjectId格式');
            return res.status(400).json({ error: '无效的记录ID格式' });
        }
        res.status(500).json({ error: '查询失败' });
    }
});

// API 3: 确认保存（处理重复情况）
app.post('/api/quotations/confirm-save', async (req, res) => {
    console.log('✅ 收到确认保存请求');
    
    const { products, action, skipDuplicates, fileInfo } = req.body;
    
    console.log('📋 确认保存请求参数:');
    console.log(`   action: ${action}`);
    console.log(`   skipDuplicates: ${skipDuplicates}`);
    console.log(`   products数量: ${products ? products.length : 0}`);
    console.log(`   fileInfo:`, fileInfo);
    
    if (products && products.length > 0) {
        console.log('🔍 检查第一个产品的结构:');
        const firstProduct = products[0];
        console.log({
            productName: firstProduct.productName,
            supplier: firstProduct.supplier,
            hasOriginalFile: !!firstProduct.originalFile,
            originalFileKeys: firstProduct.originalFile ? Object.keys(firstProduct.originalFile) : []
        });
        
        if (firstProduct.originalFile) {
            console.log('📁 第一个产品的originalFile详情:', firstProduct.originalFile);
        }
    }
    
    if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: '缺少产品数据' });
    }

    // 数据清理函数 - 处理价格字段中的逗号
    const cleanPriceData = async (productData) => {
        const cleaned = { ...productData };
        
        // 如果产品数据没有originalFile信息，但有fileInfo，则重新构建
        if (!cleaned.originalFile && fileInfo) {
            console.log(`🔧 为产品 "${cleaned.productName}" 重新构建originalFile`);
            
            // 计算文件大小和MIME类型
            let fileSize = fileInfo.size || 0;
            let mimeType = 'application/octet-stream';
            
            // 根据文件扩展名确定MIME类型
            const ext = fileInfo.fileName ? fileInfo.fileName.toLowerCase().split('.').pop() : '';
            const mimeTypes = {
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'xls': 'application/vnd.ms-excel',
                'pdf': 'application/pdf',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'doc': 'application/msword',
                'csv': 'text/csv',
                'txt': 'text/plain'
            };
            mimeType = mimeTypes[ext] || 'application/octet-stream';
            
            // 计算文件hash（如果需要的话）
            let fileHash = null;
            if (fileInfo.filePath) {
                try {
                    fileHash = await calculateFileHash(fileInfo.filePath);
                } catch (error) {
                    console.warn('⚠️ 无法计算文件hash:', error.message);
                }
            }
            
            cleaned.originalFile = {
                filename: fileInfo.fileName,
                originalName: fileInfo.originalName || fileInfo.fileName,
                path: fileInfo.filePath,
                fileSize: fileSize,
                mimetype: mimeType,
                fileHash: fileHash,
                uploadedAt: new Date()
            };
            
            console.log('✅ 重新构建的originalFile:', cleaned.originalFile);
        }
        
        // 清理价格字段，移除逗号并转换为数字
        const priceFields = ['list_price', 'quote_unit_price', 'quote_total_price'];
        
        priceFields.forEach(field => {
            if (cleaned[field] !== null && cleaned[field] !== undefined) {
                if (typeof cleaned[field] === 'string') {
                    // 移除逗号、空格和其他非数字字符（保留小数点和负号）
                    const cleanedValue = cleaned[field].toString().replace(/[,\s]/g, '');
                    const numValue = parseFloat(cleanedValue);
                    cleaned[field] = isNaN(numValue) ? null : numValue;
                } else if (typeof cleaned[field] === 'number') {
                    // 已经是数字，保持不变
                    cleaned[field] = cleaned[field];
                } else {
                    // 其他类型设为null
                    cleaned[field] = null;
                }
            }
        });
        
        // 清理折扣率
        if (cleaned.discount_rate !== null && cleaned.discount_rate !== undefined) {
            if (typeof cleaned.discount_rate === 'string') {
                const cleanedValue = cleaned.discount_rate.toString().replace(/[%,\s]/g, '');
                const numValue = parseFloat(cleanedValue);
                cleaned.discount_rate = isNaN(numValue) ? null : numValue;
            } else if (typeof cleaned.discount_rate !== 'number') {
                cleaned.discount_rate = null;
            }
        }
        
        // 清理数量
        if (cleaned.quantity !== null && cleaned.quantity !== undefined) {
            if (typeof cleaned.quantity === 'string') {
                const cleanedValue = cleaned.quantity.toString().replace(/[,\s]/g, '');
                const numValue = parseInt(cleanedValue);
                cleaned.quantity = isNaN(numValue) ? 1 : Math.max(1, numValue);
            } else if (typeof cleaned.quantity === 'number') {
                cleaned.quantity = Math.max(1, Math.floor(cleaned.quantity));
            } else {
                cleaned.quantity = 1;
            }
        } else {
            cleaned.quantity = 1;
        }
        
        // 确保必填的数字字段不为null
        if (cleaned.quote_unit_price === null || cleaned.quote_unit_price === undefined) {
            cleaned.quote_unit_price = 0;
        }
        if (cleaned.quote_total_price === null || cleaned.quote_total_price === undefined) {
            cleaned.quote_total_price = cleaned.quote_unit_price * cleaned.quantity;
        }
        
        return cleaned;
    };

    try {
        const savedQuotations = [];
        const errors = [];
        
        for (const productData of products) {
            try {
                // 清理价格数据
                const cleanedProductData = await cleanPriceData(productData);
                
                console.log(`🧹 清理后的产品数据:`, {
                    productName: cleanedProductData.productName,
                    list_price: cleanedProductData.list_price,
                    quote_unit_price: cleanedProductData.quote_unit_price,
                    quote_total_price: cleanedProductData.quote_total_price,
                    quantity: cleanedProductData.quantity,
                    hasOriginalFile: !!cleanedProductData.originalFile
                });
                
                // 如果选择跳过重复，检查是否已存在相似产品
                if (skipDuplicates) {
                    const existingProduct = await Quotation.findOne({
                        productName: { $regex: cleanedProductData.productName, $options: 'i' },
                        supplier: cleanedProductData.supplier,
                        quote_unit_price: cleanedProductData.quote_unit_price,
                        quantity: cleanedProductData.quantity
                    });
                    
                    if (existingProduct) {
                        console.log(`⏭️ 跳过重复产品: ${cleanedProductData.productName}`);
                        continue;
                    }
                }
                
                const quotation = new Quotation(cleanedProductData);
                const saved = await quotation.save();
                savedQuotations.push(saved);
                console.log(`✅ 成功保存: ${cleanedProductData.productName} (ID: ${saved._id})`);
                
            } catch (error) {
                console.error(`❌ 保存失败: ${productData.productName}`, error.message);
                errors.push({
                    productName: productData.productName,
                    error: error.message
                });
            }
        }
        
        console.log(`💾 保存完成: ${savedQuotations.length} 个产品成功, ${errors.length} 个失败`);
        
        res.json({
            success: true,
            message: `保存完成！成功: ${savedQuotations.length} 个，失败: ${errors.length} 个`,
            data: savedQuotations,
            errors: errors,
            savedCount: savedQuotations.length,
            totalCount: products.length
        });
        
    } catch (error) {
        console.error('❌ 确认保存失败:', error);
        res.status(500).json({ 
            error: '保存失败',
            details: error.message 
        });
    }
});

// API: 获取供应商列表
app.get('/api/vendors', async (req, res) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            name,
            category,
            region,
            status,
            type,
            keyword,
            isGeneralAgent,
            isAgent
        } = req.query;

        // 构建查询条件
        const filter = {};
        
        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }
        
        if (category) {
            filter.category = category;
        }
        
        if (region) {
            filter.region = region;
        }
        
        if (status) {
            filter.status = status;
        }
        
        if (type) {
            filter.type = type;
        }
        
        if (isGeneralAgent !== undefined) {
            filter.isGeneralAgent = isGeneralAgent === 'true';
        }
        
        if (isAgent !== undefined) {
            filter.isAgent = isAgent === 'true';
        }
        
        if (keyword) {
            filter.$or = [
                { name: { $regex: keyword, $options: 'i' } },
                { contact: { $regex: keyword, $options: 'i' } },
                { email: { $regex: keyword, $options: 'i' } },
                { brands: { $in: [new RegExp(keyword, 'i')] } }
            ];
        }

        // 计算分页
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        
        // 执行查询
        const [data, total] = await Promise.all([
            Vendor.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(pageSize))
                .lean(),
            Vendor.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: data,
            total: total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize))
        });

    } catch (error) {
        console.error('❌ 查询供应商列表失败:', error);
        res.status(500).json({ 
            success: false,
            error: '查询失败',
            details: error.message 
        });
    }
});

// API: 获取单个供应商详情
app.get('/api/vendors/:id', async (req, res) => {
    const vendorId = req.params.id;
    
    try {
        const vendor = await Vendor.findById(vendorId).lean();
        
        if (!vendor) {
            return res.status(404).json({ 
                success: false,
                error: '找不到供应商记录' 
            });
        }
        
        res.json({
            success: true,
            data: vendor
        });
        
    } catch (error) {
        console.error('❌ 查询供应商详情失败:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ 
                success: false,
                error: '无效的记录ID格式' 
            });
        }
        res.status(500).json({ 
            success: false,
            error: '查询失败',
            details: error.message 
        });
    }
});

// API: 创建新供应商
app.post('/api/vendors', async (req, res) => {
    try {
        const vendor = new Vendor(req.body);
        const savedVendor = await vendor.save();
        
        res.status(201).json({
            success: true,
            data: savedVendor,
            message: '供应商创建成功'
        });
        
    } catch (error) {
        console.error('❌ 创建供应商失败:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: '供应商代码已存在',
                details: error.message
            });
        }
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: '数据验证失败',
                details: Object.values(error.errors).map(err => err.message)
            });
        }
        
        res.status(500).json({ 
            success: false,
            error: '创建失败',
            details: error.message 
        });
    }
});

// API: 更新供应商信息
app.put('/api/vendors/:id', async (req, res) => {
    const vendorId = req.params.id;
    
    try {
        const updatedVendor = await Vendor.findByIdAndUpdate(
            vendorId,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!updatedVendor) {
            return res.status(404).json({ 
                success: false,
                error: '找不到供应商记录' 
            });
        }
        
        res.json({
            success: true,
            data: updatedVendor,
            message: '供应商更新成功'
        });
        
    } catch (error) {
        console.error('❌ 更新供应商失败:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: '供应商代码已存在',
                details: error.message
            });
        }
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: '数据验证失败',
                details: Object.values(error.errors).map(err => err.message)
            });
        }
        
        if (error.name === 'CastError') {
            return res.status(400).json({ 
                success: false,
                error: '无效的记录ID格式' 
            });
        }
        
        res.status(500).json({ 
            success: false,
            error: '更新失败',
            details: error.message 
        });
    }
});

// API: 删除供应商
app.delete('/api/vendors/:id', async (req, res) => {
    const vendorId = req.params.id;
    
    try {
        const deletedVendor = await Vendor.findByIdAndDelete(vendorId);
        
        if (!deletedVendor) {
            return res.status(404).json({ 
                success: false,
                error: '找不到供应商记录' 
            });
        }
        
        res.json({
            success: true,
            message: '供应商删除成功'
        });
        
    } catch (error) {
        console.error('❌ 删除供应商失败:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ 
                success: false,
                error: '无效的记录ID格式' 
            });
        }
        res.status(500).json({ 
            success: false,
            error: '删除失败',
            details: error.message 
        });
    }
});

// API: 批量导入供应商
app.post('/api/vendors/batch-import', async (req, res) => {
    try {
        const { vendors } = req.body;
        
        if (!Array.isArray(vendors) || vendors.length === 0) {
            return res.status(400).json({
                success: false,
                error: '供应商数据格式错误或为空'
            });
        }
        
        const results = [];
        const errors = [];
        
        for (const vendorData of vendors) {
            try {
                const vendor = new Vendor(vendorData);
                const savedVendor = await vendor.save();
                results.push(savedVendor);
            } catch (error) {
                errors.push({
                    vendor: vendorData,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            data: results,
            errors: errors,
            message: `成功导入 ${results.length} 个供应商，失败 ${errors.length} 个`
        });
        
    } catch (error) {
        console.error('❌ 批量导入供应商失败:', error);
        res.status(500).json({ 
            success: false,
            error: '批量导入失败',
            details: error.message 
        });
    }
});

// 前端路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 智能报价助手系统启动成功！`);
    console.log(`📡 端口: ${PORT}`);
    console.log(`🔗 访问地址: http://localhost:${PORT}`);
    console.log(`🤖 AI模型: ${YUANJING_CONFIG.model}`);
    console.log(`💾 数据库: ${MONGODB_URI}`);
    console.log(`📄 系统版本: v1.0.0`);
});