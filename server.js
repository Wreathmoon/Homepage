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
    // 新增：报价单类别和标题
    quotationCategory: {
        type: String,
        enum: ['服务器解决方案', '云服务方案', '网络设备方案', '存储解决方案', '安全设备方案', '软件系统方案', '其他'],
        default: '其他'
    },
    quotationTitle: {
        type: String,
        trim: true
    },
    supplier: {
        type: String,
        required: true,
        trim: true
    },
    
    // 价格信息 - 简化为总价模式
    list_price: {
        type: Number,
        min: 0
    },
    quote_unit_price: {
        type: Number,
        required: true,
        min: 0
    },
    unit_price: {
        type: Number,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
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
    // 新增：总价相关字段
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    discountedTotalPrice: {
        type: Number,
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
    // 新增：详细配件和项目描述
    detailedComponents: {
        type: String,
        trim: true
    },
    projectDescription: {
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
        enum: ['美国', '中国', '韩国', '日本', '芬兰', '瑞典', '荷兰', '德国', '法国', '印度', '以色列', '加拿大', '澳大利亚', '台湾', '英国', '瑞士', '新加坡', '其他'],
        default: '其他'
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
        enum: ['美国', '中国', '韩国', '日本', '芬兰', '瑞典', '荷兰', '德国', '法国', '印度', '以色列', '加拿大', '澳大利亚', '台湾', '英国', '瑞士', '新加坡', '其他'],
        default: '其他'
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
        required: false,
        trim: true,
        default: '其他'
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
        
        const prompt = `你是一个专业的报价单分析专家。请仔细分析以下报价文件内容，重点识别报价单的整体信息。

重要提示：
1. 优先识别报价单的类别（这个报价单是关于什么的）
2. 识别报价单的总价格（通常在底部有合计、总计、Total等字样）
3. 不需要逐项分析每个配件，将所有配件信息放在详细配件栏中
4. 忽略表头、标题、公司信息、联系方式等非核心信息

产品名称识别指南（重要）：
请仔细识别产品的主要名称，常见位置和表示方法：
- 文档标题或主标题中的产品名称
- 表格中的产品名称、Product Name、Item、Description列
- 配置清单中的主要产品型号
- 解决方案名称或项目名称
- 如果是多个产品的组合，使用主要产品名称或解决方案名称
- 避免使用公司名称、联系人姓名作为产品名称
- 如果无法确定具体产品名称，使用描述性名称如"服务器解决方案"、"网络设备方案"等

供应商识别指南（重要）：
正确区分供应商和设备制造商：
- 供应商(Supplier/Vendor)：实际提供报价的公司、经销商、代理商
- 设备商/制造商(Manufacturer)：产品品牌方（如Dell、HP、Cisco、IBM等）

识别规则：
- 优先识别报价单抬头、联系信息、签名处的公司名称作为供应商
- Dell、HP、Cisco、IBM、Lenovo、Microsoft、VMware、Oracle、Intel、AMD等是设备制造商，不是供应商
- 如果只能识别到设备制造商，供应商字段留空或标注"未识别"

价格术语识别指南（重要）：
不同供应商使用不同的价格术语，请仔细识别以下常见术语：

折扣前价格（原价）的常见术语：
- List Price / LP / 列表价格 / Total List Price
- MSRP (Manufacturer's Suggested Retail Price)
- Retail Price / 零售价
- Standard Price / 标准价格
- Original Price / 原价
- Catalog Price / 目录价格
- Full Price / 全价
- RRP (Recommended Retail Price)

折扣后价格（实际价格）的常见术语：
- Customer Price / Consumer Price / 客户价格 / Total Customer Price
- Net Price / 净价
- Final Price / 最终价格
- Discounted Price / 折扣价格
- Special Price / 特价
- Quote Price / 报价
- Deal Price / 成交价
- Your Price / 您的价格
- Selling Price / 销售价格
- After Discount Price / 折后价格

⚠️ 特别重要的价格识别规则：
1. 如果文档中同时出现"List Price"和"Customer Price"，则：
   - List Price = 折扣前总价 (totalPrice)
   - Customer Price = 折扣后总价 (discountedTotalPrice)

2. 如果文档中出现"Total List Price"和"Total Customer Price"，则：
   - Total List Price = 折扣前总价 (totalPrice)
   - Total Customer Price = 折扣后总价 (discountedTotalPrice)

3. 如果文档中显示折扣率（如"LP Discount %"、"Discount %"），请直接提取该数值

4. 常见的价格结构模式：
   - List Price → Discount % → Customer Price
   - Standard Price → Special Discount → Final Price
   - MSRP → Your Discount → Your Price

5. 运费和税费处理：
   - 如果有"incl. freight charges"或"including shipping"，这通常是最终的到手价
   - 基础Customer Price + 运费 = 最终到手价

单价相关术语：
- Unit Price / 单价
- Each / 每个
- Per Unit / 每单位
- Item Price / 项目价格
- Individual Price / 单个价格

总价相关术语：
- Total / 总计
- Grand Total / 总合计
- Subtotal / 小计
- Amount / 金额
- Sum / 总和
- Total Amount / 总金额
- Final Amount / 最终金额

⚠️ 重要：绝对禁止进行任何价格计算！
- 不要用总价除以数量计算单价
- 不要用单价乘以数量计算总价
- 不要计算折扣率
- 只识别文档中明确标注的价格数值
- 如果某个价格字段在文档中没有明确标注，请留空

币种识别指南（重要）：
供应商使用各种方式表示币种，请仔细识别以下常见表示方法：

币种符号：
- $ = USD (美元)
- € = EUR (欧元)
- £ = GBP (英镑)
- ¥ = CNY (人民币) 或 JPY (日元，需根据供应商地区判断)
- ₹ = INR (印度卢比)
- ₩ = KRW (韩元)
- C$ = CAD (加拿大元)
- A$ = AUD (澳大利亚元)
- S$ = SGD (新加坡元)
- HK$ = HKD (港币)

币种代码和表达方式：
- USD / US$ / US Dollar / 美元
- EUR / Euro / 欧元
- GBP / British Pound / 英镑
- CNY / RMB / Chinese Yuan / 人民币
- JPY / Japanese Yen / 日元
- INR / Indian Rupee / 印度卢比
- KRW / Korean Won / 韩元
- CAD / Canadian Dollar / 加拿大元
- AUD / Australian Dollar / 澳大利亚元
- SGD / Singapore Dollar / 新加坡元
- HKD / Hong Kong Dollar / 港币
- CHF / Swiss Franc / 瑞士法郎
- SEK / Swedish Krona / 瑞典克朗
- NOK / Norwegian Krone / 挪威克朗
- DKK / Danish Krone / 丹麦克朗

特殊表达方式：
- "IN USD" / "IN GBP" / "IN EUR" = 以某种货币计价
- "All prices in USD" = 所有价格以美元计价
- "Currency: EUR" = 货币：欧元
- "Quoted in GBP" = 以英镑报价
- "Price shown in $" = 价格以美元显示
- 如果只有符号没有明确说明，根据供应商地区推断（如美国供应商的$通常是USD）

数量识别指南（重要）：
仔细识别产品数量，常见表示方法：
- Qty / Quantity / 数量 / 件数 / 台数 / 个数 / 套数
- Units / Pieces / Sets / 单位 / 件 / 台 / 个 / 套
- 数字后跟单位：如 "5 units", "10 pieces", "3台", "2套"
- 表格中的数量列
- 如果找不到明确的数量信息，默认为1

日期识别指南（重要）：
请在文档中仔细搜索真实的日期信息，不要使用当前日期：

报价日期的常见表示：
- Quote Date / Quotation Date / 报价日期
- Date / 日期
- Issue Date / 发布日期
- Created Date / 创建日期
- 文档顶部的日期信息
- 表格中的日期列

报价有效期的常见表示：
- Valid Until / Valid Through / 有效期至
- Expiry Date / Expiration Date / 到期日期
- Quote Validity / 报价有效期
- Valid for X days / 有效X天
- "This quote is valid until..." / "本报价有效期至..."

日期格式识别：
- YYYY-MM-DD (如: 2024-03-15)
- MM/DD/YYYY (如: 03/15/2024)
- DD/MM/YYYY (如: 15/03/2024)
- DD-MM-YYYY (如: 15-03-2024)
- Month DD, YYYY (如: March 15, 2024)
- DD Month YYYY (如: 15 March 2024)
- 中文格式：2024年3月15日

重要：如果在文档中找不到明确的日期信息，请将相应的日期字段留空（null），不要使用当前日期或假设的日期。

请以JSON数组格式返回，通常一个报价单只返回一个对象，包含以下字段：

基本信息：
- quotationCategory: 报价单类别（服务器解决方案、云服务方案、网络设备方案、存储解决方案、安全设备方案、软件系统方案、其他）
- quotationTitle: 主要产品名称或解决方案名称（这是最重要的字段，请仔细识别）
- supplier: 供应商/经销商名称（从文档抬头、公司信息或签名处获取，不能是产品品牌）
- region: 地区（美国、中国、韩国、日本、芬兰、瑞典、荷兰、德国、法国、印度、以色列、加拿大、澳大利亚、台湾、英国、瑞士、新加坡、其他）

价格和数量信息（请根据上述术语指南准确识别，禁止计算）：
- totalPrice: 折扣前总价（从List Price、MSRP、Retail Price等术语识别，如果文档中没有明确标注请留空）
- discountedTotalPrice: 折扣后总价（从Customer Price、Net Price、Final Price等术语识别）
- unitPrice: 单价（直接从文档中的Unit Price、单价等字段读取，禁止计算）
- quantity: 数量（仔细识别产品数量，常见表示：Qty、Quantity、数量、件数、台数、个数等，默认为1）
- currency: 货币代码（请根据上述币种识别指南准确识别，如USD、EUR、GBP、CNY等，优先使用标准3字母代码）
- discount_rate: 整体折扣率（只有当文档中明确标注折扣率时才填写，禁止计算）

详细信息：
- detailedComponents: 详细配件清单（将所有产品/配件信息整合在这里，包括型号、规格、数量等）
- quote_validity: 报价有效期（YYYY-MM-DD格式，请在文档中搜索真实日期，如果找不到请留空null）
- delivery_date: 交付日期（如果有，YYYY-MM-DD格式）
- notes: 备注信息

数据质量要求：
- quotationCategory必须从枚举值中选择，如果无法确定则选择"其他"
- quotationTitle是最重要的字段，必须仔细识别产品名称
- totalPrice、discountedTotalPrice、unitPrice必须是数字，直接从文档读取，禁止计算
- quantity必须是正整数，仔细识别数量信息，如果找不到明确数量则默认为1
- 绝对禁止任何价格计算，包括单价计算、总价计算、折扣率计算
- supplier不能是产品品牌（如Dell、HP、Cisco等），应该是经销商/供应商公司名
- detailedComponents应该包含所有产品配件的详细信息，格式清晰易读
- 只有当文档中明确标注折扣率时才填写discount_rate字段
- quote_validity字段：请在文档中仔细搜索真实的报价有效期日期，如果找不到请设为null，不要使用当前日期

示例说明：
如果表格显示：
- 产品：Dell VSAN-RN R760，数量：3，单价：$15,895，小计：$47,685
- 运费：$5,100，税费：$9,060，总计：$61,845
- 报价方：ABC Technology Company

则应提取：
- quotationTitle: "Dell VSAN-RN R760"（产品名称）
- supplier: "ABC Technology Company"（供应商，不是Dell）
- unitPrice: 15895（直接读取单价，不计算）
- discountedTotalPrice: 61845（最终总金额）
- quantity: 3
- detailedComponents: "Dell VSAN-RN R760 × 3台，运费：$5,100，税费：$9,060"

示例2 - List Price和Customer Price结构：
如果表格显示：
- Total List Price: £40,656.71
- Total LP Discount %: 32.11%
- Total Customer Price: £27,602.89
- Freight charge: £7.50
- Total Customer price incl. freight charges: £27,610.39

则应提取：
- totalPrice: 40656.71（Total List Price，折扣前总价）
- discountedTotalPrice: 27610.39（包含运费的最终价格）
- discount_rate: 32.11（直接读取折扣率）
- currency: "GBP"（英镑）
- notes: "基础Customer Price: £27,602.89, 运费: £7.50"

请严格按照以上要求分析，绝对禁止进行任何价格计算。请直接返回JSON数组，不要包含其他解释文字。

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
        
        // 处理AI分析结果
        const processedProducts = products.map(
        (product => {
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
            
            // 新的智能价格处理逻辑
            const originalTotalPrice = cleanPrice(product.totalPrice) || 0; // 折扣前总价
            const discountedTotalPrice = cleanPrice(product.discountedTotalPrice); // 折扣后总价
            const unitPrice = cleanPrice(product.unitPrice); // 单价
            const quantity = cleanQuantity(product.quantity); // 数量
            let discountRate = cleanPrice(product.discount_rate); // AI识别的折扣率
            
            // 智能价格处理：
            // 1. 如果有折扣前和折扣后价格，自动计算折扣率
            // 2. 如果只有一个价格，根据AI的判断决定是折扣前还是折扣后
            // 3. 智能计算单价：如果有总价和数量，自动计算单价
            let finalTotalPrice = originalTotalPrice; // 最终的折扣前价格
            let finalDiscountedPrice = discountedTotalPrice; // 最终的折扣后价格
            let finalUnitPrice = unitPrice; // 最终的单价
            
            // 如果有总价和数量，但没有单价，自动计算单价
            if (!finalUnitPrice && finalTotalPrice > 0 && quantity > 0) {
                finalUnitPrice = Math.round((finalTotalPrice / quantity) * 100) / 100; // 保留两位小数
            }
            
            // 如果有单价和数量，但没有总价，自动计算总价
            if (!finalTotalPrice && finalUnitPrice > 0 && quantity > 0) {
                finalTotalPrice = finalUnitPrice * quantity;
            }
            
            // 如果有折扣前和折扣后价格，且折扣后价格小于折扣前价格，计算折扣率
            if (finalTotalPrice > 0 && finalDiscountedPrice && finalDiscountedPrice < finalTotalPrice) {
                if (!discountRate) {
                    // 自动计算折扣率：(原价 - 折扣价) / 原价 * 100
                    discountRate = Math.round(((finalTotalPrice - finalDiscountedPrice) / finalTotalPrice) * 100);
                }
            } 
            // 如果只有折扣后价格，将其作为最终价格
            else if (!finalTotalPrice && finalDiscountedPrice) {
                finalTotalPrice = finalDiscountedPrice; // 将折扣后价格作为总价显示
            }
            
            // 为了向后兼容，保留原有字段
            const listPrice = finalTotalPrice; // 使用折扣前价格作为列表价
            const quoteUnitPrice = finalDiscountedPrice ? Math.round((finalDiscountedPrice / quantity) * 100) / 100 : finalUnitPrice; // 优先使用折扣后单价
            
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
                'pdf': 'application/pdf',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'txt': 'text/plain',
                'csv': 'text/csv'
            };
            mimeType = mimeTypes[ext] || mimeType;
            
            // 处理详细配件清单 - 确保转换为字符串
            const formatDetailedComponents = (components) => {
                if (!components) return '';
                if (typeof components === 'string') return components;
                if (typeof components === 'object') {
                    if (Array.isArray(components)) {
                        return components.map(item => {
                            if (typeof item === 'string') return item;
                            if (typeof item === 'object') {
                                return Object.entries(item).map(([key, value]) => `${key}: ${value}`).join(', ');
                            }
                            return String(item);
                        }).join('\n');
                    } else {
                        return Object.entries(components).map(([key, value]) => `${key}: ${value}`).join('\n');
                    }
                }
                return String(components);
            };
            
            // 确保category字段有值并映射到正确的枚举值
            if (!product.quotationCategory) {
                product.quotationCategory = '其他';
            } else {
                // 映射类别名称到MongoDB枚举值
                const categoryMapping = {
                    '服务器解决方案': '服务器',
                    '存储解决方案': '存储设备', 
                    '网络设备方案': '网络设备',
                    '安全设备方案': '安全设备',
                    '软件系统方案': '软件系统',
                    '云服务方案': '云服务'
                };
                
                product.quotationCategory = categoryMapping[product.quotationCategory] || product.quotationCategory;
                
                // 确保最终值在有效枚举范围内
                const validCategories = ['服务器', '存储设备', '网络设备', '安全设备', '软件系统', '云服务', '其他'];
                if (!validCategories.includes(product.quotationCategory)) {
                    product.quotationCategory = '其他';
                }
            }
            
            return {
                // 基本信息
                name: product.quotationTitle || product.productName || '报价单',
                productName: product.quotationTitle || product.productName || '报价单',
                quotationCategory: product.quotationCategory || '其他',
                quotationTitle: product.quotationTitle || '',
                supplier: product.supplier || '未知供应商',
                region: product.region || '其他',
                
                // 价格信息 - 新结构
                totalPrice: finalTotalPrice,
                discountedTotalPrice: finalDiscountedPrice,
                unitPrice: finalUnitPrice,
                
                // 价格信息 - 向后兼容
                list_price: listPrice,
                quote_unit_price: quoteUnitPrice,
                unit_price: finalUnitPrice,
                quantity: quantity,
                discount_rate: discountRate,
                quote_total_price: finalDiscountedPrice || finalTotalPrice,
                currency: product.currency || 'EUR',
                
                // 详细信息
                detailedComponents: formatDetailedComponents(product.detailedComponents),
                notes: product.notes || '',
                configDetail: product.configDetail || '',
                productSpec: product.projectDescription || '',
                
                // 时间信息
                quote_validity: product.quote_validity ? new Date(product.quote_validity) : null,
                delivery_date: product.delivery_date ? new Date(product.delivery_date) : null,
                
                // 分类信息
                category: product.quotationCategory === '服务器解决方案' ? '服务器' :
                         product.quotationCategory === '存储解决方案' ? '存储设备' :
                         product.quotationCategory === '网络设备方案' ? '网络设备' :
                         product.quotationCategory === '安全设备方案' ? '安全设备' :
                         product.quotationCategory === '软件系统方案' ? '软件系统' :
                         product.quotationCategory === '云服务方案' ? '云服务' : '其他',
                
                // 状态和文件信息
                status: 'active',
                originalFile: {
                    filename: fileName,
                    originalName: fileName,
                    path: filePath,
                    fileSize: fileSize,
                    mimetype: mimeType,
                    uploadedAt: new Date()
                }
            };
        }));

        console.log(`✅ 数据验证完成，产品数量: ${processedProducts.length}`);
        
        // 🔍 检测重复
        console.log('🔍 开始检测重复...');
        const duplicates = await checkDuplicates(filePath, fileName, processedProducts);
        
        // 如果检测到重复，返回重复信息供用户选择
        if (duplicates.existingFile || duplicates.productDuplicates.length > 0) {
            console.log('⚠️ 检测到重复内容');
            return res.json({
                success: true,
                isDuplicate: true,
                duplicateInfo: duplicates,
                validatedProducts: processedProducts,
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
            products: processedProducts,
            message: `成功分析 ${processedProducts.length} 个产品`
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
        
        // 确保totalPrice字段有值（新增的必需字段）
        if (cleaned.totalPrice === null || cleaned.totalPrice === undefined) {
            cleaned.totalPrice = cleaned.quote_total_price || cleaned.quote_unit_price * cleaned.quantity;
        }
        
        // 确保quote_validity字段有值
        if (!cleaned.quote_validity) {
            // 如果没有报价有效期，设置为30天后
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            cleaned.quote_validity = futureDate;
        } else if (typeof cleaned.quote_validity === 'string') {
            // 如果是字符串，转换为Date对象
            cleaned.quote_validity = new Date(cleaned.quote_validity);
        }
        
        // 确保currency字段有值
        if (!cleaned.currency) {
            cleaned.currency = 'CNY';
        }
        
        // 确保category字段有值并映射到正确的枚举值
        if (!cleaned.category) {
            cleaned.category = '其他';
        } else {
            // 映射类别名称到MongoDB枚举值
            const categoryMapping = {
                '服务器解决方案': '服务器',
                '存储解决方案': '存储设备', 
                '网络设备方案': '网络设备',
                '安全设备方案': '安全设备',
                '软件系统方案': '软件系统',
                '云服务方案': '云服务'
            };
            
            cleaned.category = categoryMapping[cleaned.category] || cleaned.category;
            
            // 确保最终值在有效枚举范围内
            const validCategories = ['服务器', '存储设备', '网络设备', '安全设备', '软件系统', '云服务', '其他'];
            if (!validCategories.includes(cleaned.category)) {
                cleaned.category = '其他';
            }
        }
        
        // 确保region字段有值
        if (!cleaned.region) {
            cleaned.region = '其他';
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
                    supplier: cleanedProductData.supplier,
                    list_price: cleanedProductData.list_price,
                    quote_unit_price: cleanedProductData.quote_unit_price,
                    quote_total_price: cleanedProductData.quote_total_price,
                    totalPrice: cleanedProductData.totalPrice,
                    quantity: cleanedProductData.quantity,
                    currency: cleanedProductData.currency,
                    quote_validity: cleanedProductData.quote_validity,
                    category: cleanedProductData.category,
                    region: cleanedProductData.region,
                    hasOriginalFile: !!cleanedProductData.originalFile
                });
                
                // 验证必需字段
                const requiredFields = ['productName', 'supplier', 'quote_unit_price', 'quote_total_price', 'totalPrice', 'quote_validity'];
                const missingFields = requiredFields.filter(field => 
                    cleanedProductData[field] === null || 
                    cleanedProductData[field] === undefined || 
                    cleanedProductData[field] === ''
                );
                
                if (missingFields.length > 0) {
                    console.error(`❌ 缺少必需字段: ${missingFields.join(', ')}`);
                    errors.push({
                        productName: productData.productName,
                        error: `缺少必需字段: ${missingFields.join(', ')}`
                    });
                    continue;
                }
                
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
        // 数据清理
        const vendorData = { ...req.body };
        
        // 确保region字段有有效值
        if (!vendorData.region || vendorData.region === '') {
            vendorData.region = '其他';
        }
        
        // 确保country字段有有效值
        if (!vendorData.country || vendorData.country === '') {
            vendorData.country = vendorData.region; // 使用region作为country
        }
        
        // 确保必需字段有默认值
        if (!vendorData.type) {
            vendorData.type = 'HARDWARE';
        }
        
        console.log('🔧 清理后的供应商数据:', vendorData);
        
        const vendor = new Vendor(vendorData);
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