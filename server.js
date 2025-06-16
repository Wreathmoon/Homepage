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
// 添加OCR相关依赖
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const JSZip = require('jszip');

// 初始化元景大模型配置
const YUANJING_CONFIG = {
    apiKey: process.env.YUANJING_API_KEY || 'sk-59454f95d79b4d5d9ad8d5d9d6237bc1',
    model: process.env.YUANJING_MODEL || 'yuanjing-70b-chat',
    baseUrl: process.env.YUANJING_API_ENDPOINT || 'https://maas-api.ai-yuanjing.com/openapi/compatible-mode/v1'
};

// OCR处理类
class ExcelOCRProcessor {
    constructor() {
        this.tempDir = './temp_ocr/';
        this.supportedImageTypes = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'];
    }

    // 确保临时目录存在
    async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            console.log('✅ 临时目录创建成功:', this.tempDir);
        } catch (error) {
            console.warn('⚠️ 创建临时目录失败:', error);
        }
    }

    // 从Excel文件中提取图片
    async extractImagesFromExcel(filePath) {
        try {
            console.log('🖼️ 开始从Excel中提取图片...');
            console.log('📁 文件路径:', filePath);
            await this.ensureTempDir();
            
            const data = await fs.readFile(filePath);
            console.log('📊 文件读取成功，大小:', data.length, '字节');
            
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(data);
            console.log('📦 ZIP内容加载成功');
            
            const images = [];
            
            // 检查多个可能的媒体文件夹
            const mediaPaths = ['xl/media', 'xl/embeddings', 'xl/drawings', 'word/media'];
            let totalImagesFound = 0;
            
            for (const mediaPath of mediaPaths) {
                const mediaFolder = zipContent.folder(mediaPath);
                if (mediaFolder) {
                    console.log(`📂 发现媒体文件夹: ${mediaPath}`);
                    const imageFiles = [];
                    mediaFolder.forEach((relativePath, file) => {
                        if (!file.dir && this.isImageFile(relativePath)) {
                            imageFiles.push({ path: relativePath, file });
                            console.log(`🖼️ 发现图片: ${relativePath}`);
                        }
                    });
                    
                    totalImagesFound += imageFiles.length;
                    console.log(`📸 在 ${mediaPath} 中发现 ${imageFiles.length} 个图片文件`);

                    for (let i = 0; i < imageFiles.length; i++) {
                        const { path: imagePath, file } = imageFiles[i];
                        try {
                            const imageData = await file.async('nodebuffer');
                            const tempImagePath = `${this.tempDir}excel_image_${mediaPath.replace('/', '_')}_${i + 1}.png`;
                            
                            await fs.writeFile(tempImagePath, imageData);
                            console.log(`💾 图片保存成功: ${tempImagePath}, 大小: ${imageData.length} 字节`);
                            
                            images.push({
                                path: tempImagePath,
                                type: 'configuration',
                                originalName: imagePath,
                                size: imageData.length
                            });
                        } catch (error) {
                            console.error(`❌ 处理图片失败 ${imagePath}:`, error);
                        }
                    }
                }
            }
            
            console.log(`📊 图片提取完成，总共提取 ${images.length} 个图片`);
            return images;
            
        } catch (error) {
            console.error('❌ Excel图片提取失败:', error);
            console.error('错误详情:', error.message);
            console.error('错误堆栈:', error.stack);
            return [];
        }
    }

    // 检查是否为图片文件
    isImageFile(filename) {
        const ext = path.extname(filename.toLowerCase());
        const isImage = this.supportedImageTypes.includes(ext);
        console.log(`🔍 检查文件 ${filename}: ${isImage ? '是图片' : '不是图片'} (扩展名: ${ext})`);
        return isImage;
    }

    // 图片预处理（提高OCR准确率）
    async preprocessImage(imagePath) {
        try {
            console.log(`🔧 开始预处理图片: ${imagePath}`);
            const outputPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '_processed.png');
            
            await sharp(imagePath)
                .resize(null, 1200, { withoutEnlargement: true }) // 适当放大
                .sharpen() // 锐化
                .normalize() // 标准化
                .png({ quality: 100 })
                .toFile(outputPath);
                
            console.log(`✅ 图片预处理完成: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.warn('⚠️ 图片预处理失败，使用原图:', error);
            return imagePath;
        }
    }

    // 执行OCR识别
    async performOCR(imagePath) {
        try {
            console.log(`🔍 开始OCR识别图片: ${path.basename(imagePath)}`);
            
            // 检查文件是否存在
            try {
                await fs.access(imagePath);
                console.log('✅ 图片文件存在');
            } catch (error) {
                console.error('❌ 图片文件不存在:', imagePath);
                return {
                    text: '',
                    confidence: 0,
                    success: false,
                    error: '图片文件不存在'
                };
            }
            
            // 图片预处理
            const processedImagePath = await this.preprocessImage(imagePath);
            
            console.log('🤖 开始Tesseract OCR识别...');
            console.log('📝 使用语言: chi_sim+eng (中文简体+英文)');
            
            // 执行OCR识别（支持中英文）
            const { data: { text, confidence } } = await Tesseract.recognize(
                processedImagePath,
                'chi_sim+eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            console.log(`📊 OCR进度: ${Math.round(m.progress * 100)}%`);
                        } else if (m.status === 'loading tesseract core') {
                            console.log('🔄 正在加载Tesseract核心...');
                        } else if (m.status === 'initializing tesseract') {
                            console.log('🔄 正在初始化Tesseract...');
                        } else if (m.status === 'loading language traineddata') {
                            console.log('🔄 正在加载语言数据...');
                        }
                    }
                }
            );
            
            // 清理临时处理文件
            if (processedImagePath !== imagePath) {
                try {
                    await fs.unlink(processedImagePath);
                    console.log('🗑️ 临时处理文件已清理');
                } catch (e) {
                    // 忽略清理错误
                }
            }
            
            console.log(`✅ OCR识别完成`);
            console.log(`📝 识别文本长度: ${text.length} 字符`);
            console.log(`🎯 置信度: ${Math.round(confidence)}%`);
            console.log(`📄 识别内容预览: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
            
            return {
                text: text.trim(),
                confidence: confidence,
                success: true
            };
            
        } catch (error) {
            console.error(`❌ OCR识别失败 ${imagePath}:`, error);
            console.error('错误详情:', error.message);
            console.error('错误堆栈:', error.stack);
            return {
                text: '',
                confidence: 0,
                success: false,
                error: error.message
            };
        }
    }

    // 处理Excel文件（表格数据 + OCR图片）
    async processExcelWithOCR(filePath) {
        try {
            console.log('📊 开始处理Excel文件（包含OCR）...');
            console.log('📁 文件路径:', filePath);
            
            // 1. 提取表格数据（现有功能）
            console.log('📋 步骤1: 提取表格数据...');
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const tableContent = xlsx.utils.sheet_to_csv(worksheet);
            console.log('✅ 表格数据提取完成，内容长度:', tableContent.length, '字符');
            
            // 2. 提取并OCR识别图片
            console.log('📋 步骤2: 提取并OCR识别图片...');
            const images = await this.extractImagesFromExcel(filePath);
            const ocrResults = [];
            
            if (images.length > 0) {
                console.log(`🔍 开始OCR识别 ${images.length} 个图片...`);
                
                for (let i = 0; i < images.length; i++) {
                    const image = images[i];
                    console.log(`📸 处理第 ${i + 1}/${images.length} 个图片: ${image.originalName}`);
                    
                    const ocrResult = await this.performOCR(image.path);
                    if (ocrResult.success && ocrResult.text) {
                        ocrResults.push({
                            type: image.type,
                            text: ocrResult.text,
                            confidence: ocrResult.confidence,
                            originalName: image.originalName,
                            size: image.size
                        });
                        console.log(`✅ 第 ${i + 1} 个图片OCR成功，文本长度: ${ocrResult.text.length}`);
                    } else {
                        console.log(`❌ 第 ${i + 1} 个图片OCR失败: ${ocrResult.error}`);
                    }
                }
                
                // 清理临时图片文件
                await this.cleanupTempFiles(images);
            } else {
                console.log('ℹ️ 未发现图片文件');
            }
            
            // 3. 合并表格数据和OCR结果
            console.log('📋 步骤3: 合并表格数据和OCR结果...');
            let combinedContent = tableContent;
            
            if (ocrResults.length > 0) {
                combinedContent += '\n\n=== 图片中的详细配置信息 (OCR识别) ===\n';
                ocrResults.forEach((result, index) => {
                    combinedContent += `\n--- 图片 ${index + 1} (置信度: ${Math.round(result.confidence)}%) ---\n`;
                    combinedContent += `原始文件: ${result.originalName}\n`;
                    combinedContent += `识别内容:\n${result.text}\n`;
                });
                
                console.log(`✅ OCR识别完成，共识别 ${ocrResults.length} 个图片`);
                console.log(`📊 合并后内容总长度: ${combinedContent.length} 字符`);
            } else {
                console.log('ℹ️ 未发现图片或OCR识别失败，仅使用表格数据');
            }
            
            return {
                content: combinedContent,
                hasOCR: ocrResults.length > 0,
                ocrCount: ocrResults.length,
                tableContent: tableContent,
                ocrResults: ocrResults
            };
            
        } catch (error) {
            console.error('❌ Excel OCR处理失败:', error);
            console.error('错误详情:', error.message);
            console.error('错误堆栈:', error.stack);
            
            // 降级到仅表格处理
            try {
                console.log('🔄 降级到仅表格处理...');
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                return {
                    content: xlsx.utils.sheet_to_csv(worksheet),
                    hasOCR: false,
                    ocrCount: 0,
                    error: error.message
                };
            } catch (fallbackError) {
                console.error('❌ 降级处理也失败:', fallbackError);
                throw error;
            }
        }
    }

    // 清理临时文件
    async cleanupTempFiles(images) {
        console.log('🗑️ 开始清理临时文件...');
        for (const image of images) {
            try {
                await fs.unlink(image.path);
                console.log(`✅ 已删除临时文件: ${image.path}`);
            } catch (error) {
                console.warn(`⚠️ 删除临时文件失败: ${image.path}`, error.message);
            }
        }
        console.log('✅ 临时文件清理完成');
    }
}

// 创建OCR处理器实例
const ocrProcessor = new ExcelOCRProcessor();

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
                max_tokens: 6000, // 增加最大token数以处理更多内容
                top_p: 0.9,
                stream: false
            },
            {
                headers: {
                    'Authorization': `Bearer ${YUANJING_CONFIG.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 300000 // 增加到5分钟超时
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
    try {
        console.log(`📊 开始计算文件hash: ${filePath}`);
        
        // 检查文件是否存在
        try {
            await fs.access(filePath);
            console.log('✅ 文件存在，开始读取...');
        } catch (accessError) {
            console.error('❌ 文件不存在:', filePath);
            throw new Error(`文件不存在: ${filePath}`);
        }
        
        const fileBuffer = await fs.readFile(filePath);
        console.log(`📊 文件读取完成，大小: ${fileBuffer.length} 字节`);
        
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        console.log(`✅ Hash计算完成: ${hash}`);
        
        return hash;
    } catch (error) {
        console.error('❌ 计算文件hash失败:', error.message);
        throw error;
    }
};

// 检测重复上传
const checkDuplicates = async (filePath, fileName, validatedProducts) => {
    console.log('🔍 开始重复检测...');
    console.log(`   文件路径: ${filePath}`);
    console.log(`   文件名: ${fileName}`);
    console.log(`   产品数量: ${validatedProducts.length}`);
    
    const duplicates = {
        fileHash: null,
        existingFile: null,
        productDuplicates: []
    };

    try {
        // 1. 计算文件hash
        console.log('📊 正在计算文件hash...');
        const fileHash = await calculateFileHash(filePath);
        duplicates.fileHash = fileHash;
        console.log(`✅ 文件hash计算完成: ${fileHash}`);

        // 2. 检查是否有相同hash的文件已上传
        console.log('🔍 检查文件hash重复...');
        const existingFileRecord = await Quotation.findOne({
            'originalFile.fileHash': fileHash
        });

        if (existingFileRecord) {
            console.log('⚠️ 发现相同hash的文件:', existingFileRecord.originalFile.originalName);
            duplicates.existingFile = {
                id: existingFileRecord._id,
                fileName: existingFileRecord.originalFile.originalName,
                uploadDate: existingFileRecord.originalFile.uploadedAt,
                productName: existingFileRecord.productName
            };
        } else {
            console.log('✅ 未发现相同hash的文件');
        }

        // 3. 检查产品信息重复
        console.log('🔍 检查产品信息重复...');
        for (let i = 0; i < validatedProducts.length; i++) {
            const product = validatedProducts[i];
            console.log(`   检查产品 ${i + 1}/${validatedProducts.length}: ${product.productName}`);
            console.log(`   供应商: ${product.supplier}`);
            console.log(`   单价: ${product.quote_unit_price}`);
            console.log(`   数量: ${product.quantity}`);
            
            // 查找相似的产品记录
            const similarProducts = await Quotation.find({
                productName: { $regex: product.productName, $options: 'i' },
                supplier: product.supplier,
                quote_unit_price: product.quote_unit_price,
                quantity: product.quantity
            });

            console.log(`   找到 ${similarProducts.length} 个相似产品`);
            
            if (similarProducts.length > 0) {
                console.log('⚠️ 发现产品重复:', product.productName);
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

        console.log('✅ 重复检测完成');
        console.log(`   文件重复: ${duplicates.existingFile ? '是' : '否'}`);
        console.log(`   产品重复数量: ${duplicates.productDuplicates.length}`);
        
        return duplicates;
    } catch (error) {
        console.error('❌ 重复检测失败:', error);
        console.error('   错误详情:', error.message);
        console.error('   错误堆栈:', error.stack);
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
        
        
        // 读取文件内容
        let content;
        let processingInfo = { hasOCR: false, ocrCount: 0 };
        const fullPath = path.resolve(filePath);
        
        if (fileName.toLowerCase().includes('.xlsx') || fileName.toLowerCase().includes('.xls')) {
            // 使用OCR增强的Excel处理
            const excelResult = await ocrProcessor.processExcelWithOCR(fullPath);
            content = excelResult.content;
            processingInfo = {
                hasOCR: excelResult.hasOCR,
                ocrCount: excelResult.ocrCount,
                tableContent: excelResult.tableContent,
                ocrResults: excelResult.ocrResults,
                error: excelResult.error
            };
            
            console.log(`📊 Excel处理完成: 表格数据✅ OCR图片${excelResult.ocrCount}个 ${excelResult.hasOCR ? '✅' : '❌'}`);
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
        
        // 根据是否有OCR结果调整AI提示词
        let ocrPromptAddition = '';
        if (processingInfo.hasOCR) {
            ocrPromptAddition = `

⚠️ 特别说明：此文件包含图片内容，已通过OCR技术识别
- 表格数据：自动提取的结构化数据（如果有Excel表格）
- 图片内容：通过OCR识别的详细信息（共${processingInfo.ocrCount}个图片）
- 请综合分析所有可用数据源，包括表格数据和OCR识别的图片内容
- 如果是纯图片报价单，主要依赖OCR识别结果
- 如果OCR内容与表格数据有冲突，优先使用更完整、更详细的数据源

OCR识别质量说明：
${processingInfo.ocrResults ? processingInfo.ocrResults.map((r, i) => 
    `- 图片${i+1}: 置信度${Math.round(r.confidence)}% ${r.confidence > 80 ? '(高质量)' : r.confidence > 60 ? '(中等质量)' : '(低质量，请谨慎使用)'}`
).join('\n') : ''}

🔥 重要：OCR识别的所有信息都必须被充分利用！
- 不要忽略任何OCR识别的重要信息
- 将所有产品规格、配置详情、技术参数整理到detailedComponents中
- 保持原有的专业术语和技术描述
- 按照逻辑分类整理信息（硬件、软件、服务、网络等）
- 如果是纯图片报价单，OCR内容就是主要数据源`;
        }
        
        const prompt = `你是一个专业的报价单分析专家。请仔细分析以下报价文件内容，重点识别报价单的整体信息。${ocrPromptAddition}

🔥 重要提示：
1. 必须返回标准的JSON数组格式，不要包含任何markdown标记或其他文字
2. 所有字符串值必须用双引号包围
3. 数字值不要加引号，百分号等符号也不要包含在数字值中
4. detailedComponents字段必须是字符串类型，不能是对象或数组
5. 所有属性名必须用双引号包围
6. 字符串内容中的特殊字符需要转义

⚠️ JSON格式要求：
- 属性名必须用双引号："propertyName"
- 字符串值必须用双引号："string value"
- 数字值不要引号：123.45
- 布尔值不要引号：true/false
- null值不要引号：null
- 数组格式：[item1, item2]
- 对象格式：{"key": "value"}

通用报价单分析规则：

📋 产品名称识别：
- 优先识别：文档标题、主标题、产品型号、服务名称
- 表格中的：Product Name、Item、Description、Service、Model等
- 配置清单中的主要产品型号或解决方案名称
- 如果是多产品组合，使用主要产品名称或整体方案名称

🏢 供应商识别（重要）：
- 供应商：实际提供报价的公司、经销商、代理商、服务商
- 制造商：产品品牌方（Dell、HP、Cisco、IBM、Microsoft、VMware、华为、联想等）
- 优先识别报价单抬头、公司信息、联系方式、签名处的公司名称作为供应商
- 如果只能识别到制造商品牌，供应商字段使用"未识别"

💰 价格术语识别：
原价相关：List Price、MSRP、标准价格、官方价格、零售价、原价
实际价格：Customer Price、Net Price、Final Price、折扣价格、成交价、实际价
单价相关：Unit Price、单价、每个、单位价格
总价相关：Total、总计、合计、Grand Total、总金额

⚠️ 重要：绝对禁止进行任何价格计算！只识别文档中明确标注的价格数值

💱 币种识别：
- 符号：$、€、£、¥、₹、₩等
- 代码：USD、EUR、GBP、CNY、JPY、INR、KRW等
- 文字：美元、欧元、英镑、人民币、日元等

📦 数量识别：
- Qty、Quantity、数量、件数、台数、个数、套数、份数
- Units、Pieces、Sets、Items、Licenses、Subscriptions
- 单位：台、个、套、件、份、年、月、用户数、许可数
- 默认为1（如果找不到明确数量）

🔥🔥🔥 详细信息处理（超级重要）：
将所有识别的详细信息整理成易读的文本格式，放入detailedComponents字段：

格式要求：
- 使用纯文本格式，不要使用JSON对象或数组
- 每个配件/服务项目占一行
- 使用简单的"- "开头列出每个项目
- 保留原有的专业术语、型号、SKU、规格参数
- 不要过度分类，直接列出所有相关配件和服务

示例格式：
- HPE DL380 Gen11 8SFF NC CTO Server (型号: P52534-B21) × 1台
- Intel Xeon-Gold 5418Y CPU (型号: P49612-B21) × 2个
- HPE 32GB DDR4-4800 Memory Kit (型号: P43328-B21) × 4个
- HPE Smart Array E208e-p Controller (型号: JG977A) × 1个
- HPE 480GB SATA SSD (型号: P09722-B21) × 2个
- HPE 1.8TB SAS HDD (型号: P09723-B21) × 4个
- BCM 57412 10GbE Network Adapter × 2个
- HPE Cloud Management Service × 1年
- 技术支持服务 × 3年
- 运费: $500
- 税费: $2,100

重要原则：
1. 每行一个配件/服务项目
2. 包含型号/SKU信息（如果有）
3. 包含数量信息
4. 保持原有的专业术语
5. 不要添加【】分类标题
6. 直接列出，简洁明了

请严格按照以下JSON格式返回，不要包含任何其他文字：

[
  {
    "quotationCategory": "报价单类别（服务器解决方案、云服务方案、网络设备方案、存储解决方案、安全设备方案、软件系统方案、其他）",
    "quotationTitle": "主要产品名称或解决方案名称",
    "supplier": "供应商名称（不能是产品品牌）",
    "region": "地区（美国、中国、韩国、日本、德国、法国、英国、其他等）",
    "totalPrice": 折扣前总价数字（没有则为null）,
    "discountedTotalPrice": 折扣后总价数字（没有则为null）,
    "unitPrice": 单价数字（没有则为null）,
    "quantity": 数量数字（默认为1）,
    "currency": "货币代码（如USD、EUR、CNY等）",
    "discount_rate": 折扣率数字（如25表示25%，没有则为null）,
    "detailedComponents": "详细配置和服务清单的文本描述",
    "quote_validity": "报价有效期（YYYY-MM-DD格式，没有则为null）",
    "delivery_date": "交付日期（YYYY-MM-DD格式，没有则为null）",
    "notes": "备注信息"
  }
]

文件内容：
${content}`;

        const result = await callYuanJingAI(prompt);
        let text = result;
        
        console.log('🤖 AI原始回复:', text);
        
        // 强化版清理响应文本
        text = text
            // 首先移除markdown代码块标记
            .replace(/```json\s*/g, '').replace(/```\s*/g, '')
            // 移除JavaScript风格的注释
            .replace(/\/\/.*$/gm, '')          // 移除单行注释 //...
            .replace(/\/\*[\s\S]*?\*\//g, '')  // 移除多行注释 /*...*/
            // 修复常见的JSON格式错误
            .replace(/,(\s*[\]}])/g, '$1')     // 移除多余的逗号
            .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')  // 修复属性名的单引号
            .replace(/:\s*'([^']*)'(\s*[,}])/g, ': "$1"$2')     // 修复属性值的单引号
            // 修复百分号等特殊字符
            .replace(/:\s*([0-9.]+)%/g, ': $1')  // 移除百分号
            .replace(/:\s*([0-9.]+),([0-9]+)/g, ': $1$2')  // 修复数字中的逗号
            // 修复中文标点符号
            .replace(/，/g, ',')     // 中文逗号 → 英文逗号
            .replace(/：/g, ':')     // 中文冒号 → 英文冒号
            .replace(/；/g, ';')     // 中文分号 → 英文分号
            // 修复引号问题
            .replace(/"/g, '"').replace(/"/g, '"')  // 统一引号
            .replace(/'/g, "'").replace(/'/g, "'")  // 统一单引号
            // 🔥 关键修复：处理detailedComponents字段缺少引号的问题
            .replace(/detailedComponents:\s*([^,}]+)(?=[,}])/g, (match, content) => {
                // 如果内容没有被引号包围，则添加引号并转义内部引号
                if (!content.trim().startsWith('"')) {
                    const cleanContent = content
                        .replace(/"/g, '\\"')  // 转义内部双引号
                        .trim();
                    return `"detailedComponents": "${cleanContent}"`;
                }
                return match;
            })
            // 修复detailedComponents字段中的对象格式
            .replace(/"detailedComponents":\s*{[^}]*}/g, (match) => {
                // 将对象转换为字符串
                const content = match.replace(/"detailedComponents":\s*/, '');
                const cleanContent = content
                    .replace(/[{}]/g, '')
                    .replace(/"/g, '')
                    .replace(/,/g, '\n- ')
                    .replace(/:/g, ': ');
                return `"detailedComponents": "${cleanContent}"`;
            })
            // 修复不完整的字符串
            .replace(/"""+"$/g, '"')  // 修复多个引号结尾
            .replace(/,"[^"]*$/g, '')  // 移除不完整的最后一个属性
            // 修复属性名缺少引号的问题
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            // 清理多余的空白字符和空行
            .replace(/\s+/g, ' ')
            .trim();
        
        console.log('🔧 清理后的JSON:', text);

        let parsedData;
        try {
            parsedData = JSON.parse(text);
        } catch (parseError) {
            console.error('❌ JSON解析失败:', parseError);
            console.error('❌ 清理后的文本:', text);
            
            // 尝试更激进的修复方法
            try {
                // 使用更强的修复逻辑
                let fixedText = text
                    // 修复属性名缺少引号
                    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
                    // 修复字符串值缺少引号（特别处理detailedComponents）
                    .replace(/"detailedComponents":\s*([^",}]+)(?=[,}])/g, (match, content) => {
                        const cleanContent = content
                            .replace(/"/g, '\\"')  // 转义内部双引号
                            .trim();
                        return `"detailedComponents": "${cleanContent}"`;
                    })
                    // 修复其他字符串值缺少引号
                    .replace(/:\s*([^",\[\]{}0-9null][^,}]*?)(?=[,}])/g, (match, content) => {
                        if (!content.trim().startsWith('"') && !content.trim().endsWith('"')) {
                            const cleanContent = content.trim().replace(/"/g, '\\"');
                            return `: "${cleanContent}"`;
                        }
                        return match;
                    })
                    // 修复null值
                    .replace(/:\s*null\s*([,}])/g, ': null$1')
                    // 修复数字值
                    .replace(/:\s*([0-9]+\.?[0-9]*)\s*([,}])/g, ': $1$2')
                    // 最终清理
                    .replace(/,(\s*[}\]])/g, '$1')  // 移除多余逗号
                    .trim();
                
                console.log('🔧 二次修复后的JSON:', fixedText);
                parsedData = JSON.parse(fixedText);
                console.log('✅ 二次修复成功！');
            } catch (secondParseError) {
                console.error('❌ 二次JSON解析也失败:', secondParseError);
                
                // 第三次尝试：使用正则表达式提取关键信息
                try {
                    console.log('🔧 尝试第三次修复...');
                    const extractedData = {
                        quotationCategory: (text.match(/"quotationCategory":\s*"([^"]*)"/) || [])[1] || '其他',
                        quotationTitle: (text.match(/"quotationTitle":\s*"([^"]*)"/) || [])[1] || '未识别产品',
                        supplier: (text.match(/"supplier":\s*"([^"]*)"/) || [])[1] || '未知供应商',
                        region: (text.match(/"region":\s*"([^"]*)"/) || [])[1] || null,
                        totalPrice: parseFloat((text.match(/"totalPrice":\s*([0-9.]+)/) || [])[1]) || null,
                        discountedTotalPrice: parseFloat((text.match(/"discountedTotalPrice":\s*([0-9.]+)/) || [])[1]) || null,
                        unitPrice: parseFloat((text.match(/"unitPrice":\s*([0-9.]+)/) || [])[1]) || null,
                        quantity: parseInt((text.match(/"quantity":\s*([0-9]+)/) || [])[1]) || 1,
                        currency: (text.match(/"currency":\s*"([^"]*)"/) || [])[1] || 'USD',
                        discount_rate: parseFloat((text.match(/"discount_rate":\s*([0-9.]+)/) || [])[1]) || null,
                        detailedComponents: (text.match(/"detailedComponents":\s*"([^"]*)"/) || [])[1] || '',
                        quote_validity: (text.match(/"quote_validity":\s*"([^"]*)"/) || [])[1] || null,
                        delivery_date: (text.match(/"delivery_date":\s*"([^"]*)"/) || [])[1] || null,
                        notes: (text.match(/"notes":\s*"([^"]*)"/) || [])[1] || ''
                    };
                    
                    parsedData = [extractedData];
                    console.log('✅ 第三次修复成功，使用正则提取！');
                } catch (thirdError) {
                    console.error('❌ 第三次修复也失败:', thirdError);
                    return res.status(500).json({ 
                        error: 'AI返回的JSON格式不正确，请重试',
                        rawResponse: text,
                        parseError: parseError.message
                    });
                }
            }
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
                                return Object.entries(item).map(([key, value]) => {
                                    if (typeof value === 'object') {
                                        return `${key}: ${JSON.stringify(value)}`;
                                    }
                                    return `${key}: ${value}`;
                                }).join(', ');
                            }
                            return String(item);
                        }).join('\n');
                    } else {
                        return Object.entries(components).map(([key, value]) => {
                            if (typeof value === 'object') {
                                if (Array.isArray(value)) {
                                    return `${key}:\n${value.map(v => {
                                        if (typeof v === 'object') {
                                            return `- ${Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(', ')}`;
                                        }
                                        return `- ${v}`;
                                    }).join('\n')}`;
                                } else {
                                    return `${key}:\n${Object.entries(value).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
                                }
                            }
                            return `${key}: ${value}`;
                        }).join('\n\n');
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
                    fileHash: fileHash, // 确保fileHash被正确传递
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
                    fileHash: fileHash // 确保fileHash在这里也被正确传递
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