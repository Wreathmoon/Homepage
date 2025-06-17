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

// 🔥 AI基本信息提取提示词（用于分段处理）
function getBasicInfoExtractionPrompt(content) {
    return `你是一个专业的报价单分析专家。请从以下报价文件内容中提取基本信息。

🔥🔥🔥 重要警告：你的任务是识别整个解决方案/项目的总价，而不是单个配件的价格！

⚠️ 价格识别重点：
- 寻找整个解决方案/项目的总价、合计、总金额、项目总价、解决方案价格
- 优先寻找：Total、Grand Total、总计、合计、总金额、项目总价、解决方案价格、Final Price、Net Total
- 忽略单个配件价格，如果看到多个价格，选择最大的那个（通常是总价）
- 关注表格底部的合计行、总计行、Summary行
- 如果是HPE服务器解决方案，总价通常在$40,000-100,000左右，不是$3,799.42这样的单个配件价格
- 如果是云服务方案，通常是月费或年费，注意识别计费周期

🔥 产品类别识别重点：
- 识别主要设备类别：服务器解决方案、存储解决方案、网络设备方案、云服务方案、安全设备方案、软件系统方案
- 不要识别具体型号（如HPE DL380 Gen11），要识别解决方案类别（如"HPE服务器解决方案"）
- 优先寻找：解决方案名称、系统名称、项目名称、方案标题、Solution、System、Package

🏢 供应商识别重点：
- 供应商是实际提供报价的公司、经销商、代理商、服务商
- 不是产品品牌（HPE、Dell、Cisco、IBM、Microsoft、VMware、华为、联想等都是品牌，不是供应商）
- 优先识别：报价单抬头、公司信息、联系方式、签名处的公司名称
- 查找：Vendor、Supplier、Company、From、Quoted by等字段
- 如果只能识别到制造商品牌，供应商字段使用"未识别"

💱 货币识别：
- 符号：$=USD、€=EUR、£=GBP、¥=CNY、₹=INR、₩=KRW等
- 代码：USD、EUR、GBP、CNY、JPY、INR、KRW等
- 文字：美元=USD、欧元=EUR、英镑=GBP、人民币=CNY、日元=JPY等

📅 日期识别：
- 报价有效期：Valid until、Expires、有效期、到期日期
- 交付日期：Delivery、Ship date、交付、发货日期
- 格式统一为：YYYY-MM-DD

🌍 地区识别：
- 根据供应商地址、联系方式、货币等判断
- 常见地区：美国、中国、韩国、日本、德国、法国、英国、新加坡等

⚠️ 重要提醒：
1. 只提取基本信息，不要处理详细配置
2. 专注于价格、供应商、类别等关键信息
3. 如果信息不确定，宁可标记为null或"未识别"
4. 绝对不要进行任何价格计算

请严格按照以下JSON格式返回基本信息，不要包含任何其他文字：

{
  "quotationCategory": "报价单类别（服务器解决方案、云服务方案、网络设备方案、存储解决方案、安全设备方案、软件系统方案、其他）",
  "quotationTitle": "整体解决方案名称或项目名称",
  "supplier": "供应商名称（不能是产品品牌）",
  "region": "地区（美国、中国、韩国、日本、德国、法国、英国、其他等）",
  "totalPrice": 整个项目的总价数字（没有则为null）,
  "discountedTotalPrice": 折扣后总价数字（没有则为null）,
  "currency": "货币代码（如USD、EUR、CNY等）",
  "quote_validity": "报价有效期（YYYY-MM-DD格式，没有则为null）",
  "delivery_date": "交付日期（YYYY-MM-DD格式，没有则为null）",
  "notes": "重要备注信息（简短）"
}

文件内容：
${content}`;
}

// 🔥 内容分段函数
function splitContentIntoChunks(content, maxChunkSize = 8000) {
    console.log(`📄 开始分段处理，内容总长度: ${content.length} 字符，最大分段大小: ${maxChunkSize}`);
    
    if (content.length <= maxChunkSize) {
        console.log('📄 内容较短，无需分段');
        return [content];
    }
    
    const chunks = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let currentSize = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineSize = line.length + 1; // +1 for newline
        
        // 如果添加这一行会超过限制，且当前chunk不为空，则保存当前chunk
        if (currentSize + lineSize > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            console.log(`📄 分段 ${chunks.length}: ${currentChunk.length} 字符`);
            currentChunk = line + '\n';
            currentSize = lineSize;
        } else {
            currentChunk += line + '\n';
            currentSize += lineSize;
        }
    }
    
    // 添加最后一个chunk
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        console.log(`📄 分段 ${chunks.length}: ${currentChunk.length} 字符`);
    }
    
    console.log(`✅ 分段完成，共 ${chunks.length} 个分段`);
    return chunks;
}

// 🔥 分段处理主函数
async function processContentInChunks(content, processingInfo) {
    console.log('🔄 开始分段处理内容...');
    
    try {
        // 1. 首先提取基本信息
        console.log('📋 步骤1: 提取基本信息...');
        const basicInfoPrompt = getBasicInfoExtractionPrompt(content);
        const basicInfoResult = await callYuanJingAI(basicInfoPrompt);
        
        console.log('🤖 基本信息AI原始回复:', basicInfoResult);
        
        // 清理和解析基本信息
        let basicInfoText = basicInfoResult
            .replace(/```json\s*/g, '').replace(/```\s*/g, '')
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // 🔥 修复JSON格式问题
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // 修复属性名缺少引号
            .replace(/:\s*([^",\[\]{}0-9null][^,}]*?)(?=[,}])/g, (match, content) => {
                // 修复字符串值缺少引号
                if (!content.trim().startsWith('"') && !content.trim().endsWith('"')) {
                    const cleanContent = content.trim().replace(/"/g, '\\"');
                    return `: "${cleanContent}"`;
                }
                return match;
            })
            .trim();
        
        let parsedData;
        try {
            const basicInfo = JSON.parse(basicInfoText);
            console.log('✅ 基本信息解析成功:', basicInfo);
            
            // 🔥 处理AI返回的价格和货币格式
            const processAIBasicInfo = (info) => {
                const processed = { ...info };
                
                // 处理价格字段 - 去除货币符号和格式化
                const cleanAIPrice = (priceValue) => {
                    if (!priceValue) return null;
                    if (typeof priceValue === 'number') return priceValue;
                    if (typeof priceValue === 'string') {
                        // 去除货币符号、逗号、空格等
                        const cleanedValue = priceValue.replace(/[$€£¥₹₩,\s]/g, '');
                        const numValue = parseFloat(cleanedValue);
                        return isNaN(numValue) ? null : numValue;
                    }
                    return null;
                };
                
                // 处理货币字段 - 标准化货币代码
                const cleanAICurrency = (currencyValue) => {
                    if (!currencyValue) return 'USD';
                    if (typeof currencyValue === 'string') {
                        // 处理 '$=USD' 这种格式
                        if (currencyValue.includes('=')) {
                            return currencyValue.split('=')[1] || 'USD';
                        }
                        // 货币符号映射
                        const symbolToCurrency = {
                            '$': 'USD',
                            '€': 'EUR', 
                            '£': 'GBP',
                            '¥': 'CNY',
                            '₹': 'INR',
                            '₩': 'KRW'
                        };
                        return symbolToCurrency[currencyValue] || currencyValue.toUpperCase();
                    }
                    return 'USD';
                };
                
                processed.totalPrice = cleanAIPrice(info.totalPrice);
                processed.discountedTotalPrice = cleanAIPrice(info.discountedTotalPrice);
                processed.currency = cleanAICurrency(info.currency);
                
                console.log('🔧 AI基本信息处理后:', {
                    totalPrice: processed.totalPrice,
                    discountedTotalPrice: processed.discountedTotalPrice,
                    currency: processed.currency
                });
                
                return processed;
            };
            
            const processedBasicInfo = processAIBasicInfo(basicInfo);
            
            // 🔥 智能判断使用哪个数据源作为详细配置
            let detailedComponents = '';
            
            // 判断OCR内容是否有意义的函数
            const isOCRContentMeaningful = (ocrResults) => {
                if (!ocrResults || ocrResults.length === 0) return false;
                
                let totalMeaningfulContent = 0;
                let totalConfidence = 0;
                
                for (const result of ocrResults) {
                    const text = result.text || '';
                    const confidence = result.confidence || 0;
                    
                    // 检查是否包含有意义的内容
                    const hasMeaningfulContent = 
                        // 包含产品型号/规格
                        /[A-Z0-9]{3,}[-_][A-Z0-9]{2,}|[A-Z]{2,}\d{3,}|\d+GB|\d+TB|\d+MHz|\d+GHz/i.test(text) ||
                        // 包含价格信息
                        /\$[\d,]+\.?\d*|€[\d,]+\.?\d*|£[\d,]+\.?\d*|¥[\d,]+\.?\d*/i.test(text) ||
                        // 包含配置关键词
                        /(CPU|Memory|Storage|Disk|Network|Processor|RAM|SSD|HDD)/i.test(text) ||
                        // 包含数量和型号
                        /\d+\s*(x|×)\s*[A-Z0-9]/i.test(text) ||
                        // 内容长度足够且置信度高
                        (text.length > 100 && confidence > 70);
                    
                    if (hasMeaningfulContent) {
                        totalMeaningfulContent++;
                        totalConfidence += confidence;
                    }
                    
                    console.log(`📸 图片 ${ocrResults.indexOf(result) + 1} 评估:`, {
                        textLength: text.length,
                        confidence: Math.round(confidence),
                        hasMeaningful: hasMeaningfulContent,
                        preview: text.substring(0, 100)
                    });
                }
                
                const avgConfidence = totalMeaningfulContent > 0 ? totalConfidence / totalMeaningfulContent : 0;
                const meaningfulRatio = totalMeaningfulContent / ocrResults.length;
                
                console.log(`🔍 OCR内容评估结果:`, {
                    meaningfulImages: totalMeaningfulContent,
                    totalImages: ocrResults.length,
                    meaningfulRatio: Math.round(meaningfulRatio * 100) + '%',
                    avgConfidence: Math.round(avgConfidence) + '%'
                });
                
                // 如果超过50%的图片有意义且平均置信度>60%，则认为OCR内容有意义
                return meaningfulRatio > 0.5 && avgConfidence > 60;
            };
            
            if (processingInfo.hasOCR && processingInfo.ocrResults && processingInfo.ocrResults.length > 0) {
                const ocrIsMeaningful = isOCRContentMeaningful(processingInfo.ocrResults);
                
                if (ocrIsMeaningful) {
                    console.log(`✅ OCR内容有意义，使用OCR识别的 ${processingInfo.ocrResults.length} 个图片内容作为详细配置`);
                    
                    // 🔥 OCR文本格式优化函数
                    const formatOCRText = (text) => {
                        if (!text) return '';
                        
                        return text
                            // 移除多余的空行
                            .replace(/\n\s*\n\s*\n/g, '\n\n')
                            // 修复奇怪的换行 - 合并被断开的单词
                            .replace(/([a-zA-Z])\n([a-z])/g, '$1$2')
                            // 修复数字和单位的换行
                            .replace(/(\d+)\n(GB|TB|MHz|GHz|W|V|A)/g, '$1$2')
                            // 修复型号的换行
                            .replace(/([A-Z0-9]+)\n([A-Z0-9]+)/g, '$1$2')
                            // 清理行首行尾空格
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0)
                            .join('\n')
                            // 限制连续空行
                            .replace(/\n{3,}/g, '\n\n');
                    };
                    
                    // 直接使用OCR识别的内容，按图片分组并格式化
                    const ocrComponents = processingInfo.ocrResults.map((result, index) => {
                        const confidence = Math.round(result.confidence);
                        const qualityNote = confidence > 80 ? '(高质量识别)' : confidence > 60 ? '(中等质量识别)' : '(低质量识别，请人工核实)';
                        const formattedText = formatOCRText(result.text);
                        
                        return `=== 配置图片 ${index + 1} ${qualityNote} ===
原始文件: ${result.originalName}
识别置信度: ${confidence}%

${formattedText}`;
                    }).join('\n\n');
                    
                    detailedComponents = ocrComponents;
                } else {
                    console.log(`⚠️ OCR内容无意义，优先使用表格/文本数据作为详细配置`);
                    
                    // OCR内容无意义，使用表格或文本数据
                    if (processingInfo.tableContent && processingInfo.tableContent.trim().length > 100) {
                        console.log(`📊 使用Excel表格数据作为详细配置`);
                        detailedComponents = `=== Excel表格数据 ===
${processingInfo.tableContent}`;
                    } else {
                        console.log(`📄 使用原始文档内容作为详细配置`);
                        detailedComponents = `=== 文档内容 ===
${content.length > 2000 ? content.substring(0, 2000) + '\n\n[内容过长，已截取前2000字符]' : content}`;
                    }
                    
                    // 如果还是想显示OCR内容作为参考，可以添加到末尾
                    if (processingInfo.ocrResults && processingInfo.ocrResults.length > 0) {
                        detailedComponents += '\n\n=== OCR图片内容（仅供参考，可能无意义） ===\n';
                        processingInfo.ocrResults.forEach((result, index) => {
                            const confidence = Math.round(result.confidence);
                            detailedComponents += `\n图片 ${index + 1} (置信度: ${confidence}%): ${result.originalName}\n${result.text.substring(0, 200)}${result.text.length > 200 ? '...' : ''}\n`;
                        });
                    }
                }
                
                console.log(`✅ 详细配置整理完成，总长度: ${detailedComponents.length} 字符`);
            } else {
                console.log('ℹ️ 没有OCR识别内容，使用表格/文本数据作为详细配置');
                // 如果没有OCR内容，使用原始内容作为详细配置
                if (processingInfo.tableContent) {
                    detailedComponents = `=== 表格数据 ===
${processingInfo.tableContent}`;
                } else {
                    detailedComponents = `=== 文档内容 ===
${content}`;
                }
            }
            
            // 构建最终结果
            const finalResult = {
                ...processedBasicInfo,
                detailedComponents: detailedComponents,
                quantity: 1, // 默认数量
                unitPrice: processedBasicInfo.discountedTotalPrice || processedBasicInfo.totalPrice || null
            };
            
            parsedData = [finalResult];
            console.log('✅ AI基本信息处理完成，详细配置使用最佳数据源');
            
        } catch (parseError) {
            console.error('❌ 基本信息JSON解析失败:', parseError);
            console.error('❌ 清理后的文本:', basicInfoText);
            
            // 使用默认基本信息
            const defaultBasicInfo = {
                quotationCategory: '其他',
                quotationTitle: '报价单',
                supplier: '未知供应商',
                region: '其他',
                totalPrice: null,
                discountedTotalPrice: null,
                currency: 'USD',
                quote_validity: null,
                delivery_date: null,
                notes: ''
            };
            
            // 准备详细配置信息
            let detailedComponents = '';
            if (processingInfo.hasOCR && processingInfo.ocrResults && processingInfo.ocrResults.length > 0) {
                const ocrComponents = processingInfo.ocrResults.map((result, index) => {
                    const confidence = Math.round(result.confidence);
                    const qualityNote = confidence > 80 ? '(高质量识别)' : confidence > 60 ? '(中等质量识别)' : '(低质量识别，请人工核实)';
                    
                    return `=== 配置图片 ${index + 1} ${qualityNote} ===
原始文件: ${result.originalName}
识别置信度: ${confidence}%

${result.text}`;
                }).join('\n\n');
                
                detailedComponents = ocrComponents;
            } else if (processingInfo.tableContent) {
                detailedComponents = `=== 表格数据 ===
${processingInfo.tableContent}`;
            } else {
                detailedComponents = `=== 文档内容 ===
${content}`;
            }
            
            const fallbackResult = {
                ...defaultBasicInfo,
                detailedComponents: detailedComponents,
                quantity: 1,
                unitPrice: null
            };
            
            parsedData = [fallbackResult];
            console.log('⚠️ 使用默认基本信息，详细配置使用原始数据');
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
        } else {
            // 🔥 货币符号转换为标准货币代码
            const convertCurrencySymbolToCode = (currency) => {
                if (!currency) return 'USD';
                
                // 货币符号到代码的映射
                const symbolToCode = {
                    '$': 'USD',
                    '￥': 'CNY',
                    '¥': 'JPY',
                    '€': 'EUR',
                    '£': 'GBP',
                    '₹': 'INR',
                    '₩': 'KRW',
                    '₽': 'RUB',
                    'A$': 'AUD',
                    'C$': 'CAD',
                    'S$': 'SGD',
                    'CHF': 'CHF',
                    'HK$': 'HKD',
                    'NT$': 'TWD',
                    '₫': 'VND',
                    'Rp': 'IDR',
                    'R$': 'BRL',
                    'R': 'ZAR',
                    'MX$': 'MXN',
                    'NZ$': 'NZD',
                    'kr': 'SEK',
                    'NOK': 'NOK',
                    'DKK': 'DKK',
                    'zł': 'PLN',
                    'Ft': 'HUF',
                    'Kč': 'CZK',
                    '₺': 'TRY',
                    'ر.س': 'SAR',
                    'د.إ': 'AED',
                    '₪': 'ILS'
                };
                
                // 如果是符号，转换为代码
                if (symbolToCode[currency]) {
                    return symbolToCode[currency];
                }
                
                // 如果已经是代码，验证是否有效
                const validCurrencyCodes = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'AUD', 'CAD', 'SGD', 'CHF', 'RUB', 'INR', 'KRW', 'THB', 'MYR', 'TWD', 'VND', 'IDR', 'BRL', 'ZAR', 'MXN', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'HUF', 'CZK', 'TRY', 'SAR', 'AED', 'ILS'];
                
                if (validCurrencyCodes.includes(currency.toUpperCase())) {
                    return currency.toUpperCase();
                }
                
                // 默认返回USD
                return 'USD';
            };
            
            // 转换货币符号为标准代码
            cleaned.currency = convertCurrencySymbolToCode(cleaned.currency);
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
