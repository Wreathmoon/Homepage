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

// 🔥 AI数据清洗统一管理类
class AIDataCleaner {
    constructor() {
        this.cache = new Map(); // 简单的内存缓存
        this.config = {
            minLinesForAI: 10,        // 启用AI清洗的最小行数
            maxCacheSize: 100,        // 最大缓存条目数
            cacheExpiryTime: 60 * 60 * 1000, // 缓存过期时间(1小时)
            maxLinesToProcess: 100    // AI处理的最大行数
        };
    }

    // 生成缓存键
    generateCacheKey(rawData, dataType) {
        const hash = crypto.createHash('md5').update(rawData + dataType).digest('hex');
        return `ai_annotation_${hash}`;
    }

    // 检查缓存
    getCachedAnnotation(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cacheExpiryTime) {
            console.log('✅ 使用缓存的AI标注结果');
            return cached.data;
        }
        return null;
    }

    // 设置缓存
    setCachedAnnotation(cacheKey, data) {
        if (this.cache.size >= this.config.maxCacheSize) {
            // 清理最旧的缓存条目
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
    }

    // 统一的AI数据标注函数
    async annotateData(rawData, dataType = 'excel') {
        console.log('🤖 开始AI数据标注 (简化版)...');
        
        if (!rawData || rawData.trim().length === 0) {
            console.warn('⚠️ 数据为空，跳过AI标注');
            return null;
        }
        
        // 🔥 检查缓存
        const cacheKey = this.generateCacheKey(rawData, dataType);
        const cachedResult = this.getCachedAnnotation(cacheKey);
        if (cachedResult) {
            console.log('✅ 使用缓存的AI标注结果');
            return cachedResult;
        }
        
        try {
            console.log('🤖 调用AI进行数据标注...');
            
            // 🔥 简化的AI提示词 - 只识别有用行
            const prompt = `你是一个专业的ICT产品数据分析专家。请分析以下数据，识别出包含有用产品信息的行号。

**数据内容：**
${rawData}

**识别标准：**
一行一行查看，不要跳过任何一行，不要遗漏任何一行
行，列对应很重要，寻找description，sku，型号，价格，数量，品牌，技术规格，产品描述，配置信息，等有用信息
✅ **有用信息包括：**
- 产品型号（如CPU型号，内存型号，硬件型号，软件型号，数据库型号，license型号 ）， 注意观察各种英文型号， 如 INTEL，AMD，HPE，DELL，CISCO，VMWARE，MICROSOFT，ORACLE，SAP，MYSQL，SQLSERVER，LINUX，WINDOWS，MACOS，IOS，ANDROID
-还有可以看专属于科技产品的名词，比如：SATA,Nvme,SSD,HDD,GB,TB,GHz,MHz,Gbps,W,cores,license,TB,SAS等科技领域常用词
- 技术规格参数（CPU、内存、存储、网络等,也包括软件方面，以及数据库和lience相关），
- 产品描述和配置信息
- 价格和数量信息
- 品牌产品信息
- 一切包含了产品型号和描述的行都是有用信息
-不要省略任何产品型号和描述的行号

❌ **无用信息包括：**
- 纯表格标题行
- 空行或只有分隔符的行
- 重复的标识符
- 法律条文等
- 报价单的页眉页脚
-一切与技术无关的行

**输出要求：**
请返回JSON格式，只包含有用行号的数组：

\`\`\`json
{
  "useful": [3, 5, 7, 9, 12, 15, 18, 20, 23, 25, 28, 30]
}
\`\`\`

**重要：**
- 只返回有用行的行号数组
- 不需要解释原因
- 不需要分类
- 不需要识别无用行
-格式严格按照示例-只要json格式，不要其他任何内容,不要注释,不要解释
- 行号从1开始计数`;

            const aiResponse = await this.callAI(prompt, '第二次AI-识别有用行');
            
            // 🔥 解析AI响应
            try {
                const annotation = SmartJSONParser.parseAIResponse(aiResponse, 'AI数据标注');
                
                if (annotation && annotation.useful && Array.isArray(annotation.useful)) {
                    console.log(`✅ AI标注成功: 识别出${annotation.useful.length}个有用行`);
                    
                    // 🔥 缓存结果
                    this.setCachedAnnotation(cacheKey, annotation);
                    
                    return annotation;
                } else {
                    console.warn('⚠️ AI返回结果格式无效');
                    return this.fallbackAnnotation(rawData);
                }
                
            } catch (parseError) {
                console.warn('⚠️ AI响应解析失败:', parseError.message);
                return this.fallbackAnnotation(rawData);
            }
            
        } catch (error) {
            console.error('❌ AI数据标注失败:', error);
            return this.fallbackAnnotation(rawData);
        }
    }

    // 🔥 简化的降级标注（本地规则）
    fallbackAnnotation(rawData) {
        console.log('🔧 本地规则标注...');
        
        const dataLines = rawData.split('\n');
        const useful = [];
        
        // 🔥 简化的本地规则：识别有价值的行
        dataLines.forEach((line, index) => {
            const trimmedLine = line.trim();
            const lineNumber = index + 1;
            
            // 跳过明显无用的行
            if (!trimmedLine || trimmedLine.length < 3) return;
            if (/^[\|\s\-_=,\.]{5,}$/.test(trimmedLine)) return;
            if (/^(列\d+:|行\d+:.*\[空\]|PART\s+NUMBER|DESCRIPTION)$/i.test(trimmedLine)) return;
            
            // 识别有价值的行
            const hasValue = (
                /[A-Z]\d{5}-[A-Z]\d{2}/.test(trimmedLine) ||  // SKU格式
                /\b(HPE|Dell|Cisco|Intel|AMD|Microsoft|VMware)\b/i.test(trimmedLine) ||  // 品牌
                /\d+\s*(GB|TB|GHz|MHz|Gbps|W|cores?)\b/i.test(trimmedLine) ||  // 技术规格
                /\\$\\d+[\\d,]*\\.?\\d*/.test(trimmedLine) ||  // 价格
                /\b(Server|Storage|Switch|Router|Processor|Memory|SSD|HDD)\b/i.test(trimmedLine) ||  // 产品类型
                /\b(Gen\d+|R\d+|DL\d+|ML\d+)\b/i.test(trimmedLine)  // 产品代数
            );
            
            if (hasValue) {
                useful.push(lineNumber);
            }
        });
        
        console.log(`🔧 本地规则标注完成: 有用${useful.length}行`);
        
        return {
            useful: useful
        };
    }

    // 统一的数据清洗函数
    cleanDataByAnnotation(rawData, annotation) {
        console.log('🧹 根据AI标注清洗数据...');
        
        if (!annotation || !annotation.useful) {
            console.warn('⚠️ 标注结果无效，返回原始数据');
            return rawData;
        }
        
        const lines = rawData.split('\n');
        const cleanedLines = [];
        
        // 根据AI标注的有用行号提取数据
        annotation.useful.forEach(lineNumber => {
            const lineIndex = lineNumber - 1; // 转换为数组索引
            if (lineIndex >= 0 && lineIndex < lines.length) {
                const line = lines[lineIndex].trim();
                if (line) {
                    cleanedLines.push(line);
                }
            }
        });
        
        const retentionRate = Math.round(cleanedLines.length / lines.length * 100);
        console.log(`✅ 数据清洗完成: ${lines.length} 行 → ${cleanedLines.length} 行 (保留 ${retentionRate}%)`);
        
        // 直接返回清洗后的数据，不再按类别重新组织
        return cleanedLines.join('\n');
    }

    // 🔥 新增：AI格式整理和OCR修复函数
    async formatAndFixDataWithAI(rawData, annotation) {
        console.log('🤖 开始AI格式整理和OCR修复...');
        
        if (!annotation || !annotation.useful || annotation.useful.length === 0) {
            console.warn('⚠️ 标注结果无效，跳过AI格式整理');
            return rawData;
        }
        
        try {
            const lines = rawData.split('\n');
            const extractedData = [];
            
            // 🔥 提取标注行号对应的实际内容
            annotation.useful.forEach((lineNumber, index) => {
                const lineIndex = lineNumber - 1;
                if (lineIndex >= 0 && lineIndex < lines.length) {
                    const line = lines[lineIndex].trim();
                    if (line) {
                        extractedData.push({
                            lineNumber: lineNumber,
                            originalContent: line,
                            category: this.findLineCategory(lineNumber, annotation.categories)
                        });
                    }
                }
            });
            
            if (extractedData.length === 0) {
                console.warn('⚠️ 没有提取到有效数据');
                return rawData;
            }
            
            console.log('🤖 正在调用AI进行格式整理...');
            const aiResponse = await this.callAI(prompt, 'AI格式整理和OCR修复');
            
            // 🔥 解析AI响应
            const formattedResult = SmartJSONParser.parseAIResponse(aiResponse, 'AI格式整理');
            
            if (formattedResult && formattedResult.formattedData) {
                console.log('✅ AI格式整理完成');
                console.log(`📊 整理统计: 总行数${formattedResult.summary?.totalLines || extractedData.length}, 修复${formattedResult.summary?.fixedCount || 0}处`);
                
                // 🔥 重新组织数据
                const organizedContent = [];
                
                formattedResult.formattedData.forEach(categoryGroup => {
                    if (categoryGroup.items && categoryGroup.items.length > 0) {
                        organizedContent.push(`\n=== ${categoryGroup.category} ===`);
                        categoryGroup.items.forEach(item => {
                            organizedContent.push(`• ${item.formattedContent}`);
                            if (item.fixes && item.fixes.length > 0) {
                                console.log(`🔧 行${item.lineNumber}修复: ${item.fixes.join(', ')}`);
                            }
                        });
                    }
                });
                
                return organizedContent.join('\n');
            } else {
                console.warn('⚠️ AI格式整理结果无效，使用原始清洗结果');
                return this.cleanDataByAnnotation(rawData, annotation);
            }
            
        } catch (error) {
            console.error('❌ AI格式整理失败:', error);
            console.warn('⚠️ 降级使用基础清洗结果');
            return this.cleanDataByAnnotation(rawData, annotation);
        }
    }
    
    // 🔥 辅助函数：查找行号对应的类别
    findLineCategory(lineNumber, categories) {
        if (!categories) return '其他产品';
        
        for (const [categoryName, lineNumbers] of Object.entries(categories)) {
            if (lineNumbers && lineNumbers.includes(lineNumber)) {
                return categoryName;
            }
        }
        return '其他产品';
    }

    // 🔥 新增：格式化显示函数 - 简化版本，不分类，不使用图标
    formatForDisplay(cleanedData, annotation = null) {
        console.log('🎨 开始格式化数据用于显示...');
        
        if (!cleanedData || typeof cleanedData !== 'string') {
            return '暂无配置信息';
        }
        
        try {
            const lines = cleanedData.split('\n');
            const result = [];
            
            // 🔥 简化处理：不分类，直接格式化所有行，不添加图标
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && trimmedLine.length > 2) {
                    const formattedLine = this.formatConfigLine(trimmedLine);
                    if (formattedLine && formattedLine.trim()) {
                        result.push(formattedLine);
                    }
                }
            });
            
            if (result.length === 0) {
                return '暂无有效配置信息';
            }
            
            // 🔥 简单的标题，不使用图标
            const finalResult = ['**产品配置信息**', '─'.repeat(30), ...result].join('\n');
            
            console.log(`✅ 数据格式化完成，共 ${result.length} 行有效内容`);
            return finalResult;
            
        } catch (error) {
            console.error('❌ 数据格式化失败:', error);
            return cleanedData; // 返回原始数据
        }
    }
    
    // 🔥 优化的单行格式化（修复换行问题，不使用图标）
    formatConfigLine(line) {
        if (!line || line.trim().length === 0) {
            return null;
        }
        
        let formattedLine = line.trim();
        
        // 🔥 预处理：移除多余的空白和换行符
        formattedLine = formattedLine.replace(/\s+/g, ' ').replace(/\n+/g, ' ');
        
        // 🔥 只过滤明显的无用信息
        if (/^[\|\s\-_=,\.]{5,}$/.test(formattedLine)) {
            return null;
        }
        
        if (/^\[空\]$|^Empty$|^N\/A$|^null$|^undefined$/i.test(formattedLine)) {
            return null;
        }
        
        if (/^(PART\s+NUMBER\s*\|.*DESCRIPTION\s*\|.*PRICE)/i.test(formattedLine)) {
            return null;
        }
        
        // 🔥 智能高亮关键信息
        formattedLine = formattedLine.replace(/\b([A-Z]\d{5}-[A-Z]\d{2})\b/g, '**$1**');
        formattedLine = formattedLine.replace(/\b([A-Z]{2,4}[\d\-]{4,})\b/g, '**$1**');
        formattedLine = formattedLine.replace(/(\d+\s*(GB|TB|GHz|MHz|Gbps|Mbps|W|V|cores?))\b/gi, '`$1`');
        formattedLine = formattedLine.replace(/\b(Gen\d+|R\d+|v\d+\.\d+)\b/gi, '`$1`');
        formattedLine = formattedLine.replace(/(\d+)\s*[×xX]\s*/g, '**$1×**');
        formattedLine = formattedLine.replace(/\b(HPE|Dell|Cisco|VMware|Microsoft|Oracle|Intel|AMD)\b/gi, '**$1**');
        formattedLine = formattedLine.replace(/\b(Enterprise|Professional|Standard|Premium|Smart|Array)\b/gi, '**$1**');
        
        // 🔥 修复表格数据显示（特别处理价格格式）
        if (formattedLine.includes('|')) {
            const parts = formattedLine.split('|').map(p => p.trim());
            const meaningfulParts = parts.filter(p => {
                if (!p || p === '[空]' || p === 'Empty') return false;
                return /[a-zA-Z0-9]/.test(p);
            });
            
            if (meaningfulParts.length > 0) {
                // 🔥 修复价格格式
                const fixedParts = [];
                let i = 0;
                
                while (i < meaningfulParts.length) {
                    let currentPart = meaningfulParts[i];
                    
                    if (i < meaningfulParts.length - 1) {
                        const nextPart = meaningfulParts[i + 1];
                        
                        if (/^\$[\d,]+,$/.test(currentPart) && /^\d+\.\d{2}$/.test(nextPart)) {
                            currentPart = currentPart.replace(/,$/, '') + nextPart;
                            i++;
                        } else if (/[\d,]+,$/.test(currentPart) && /^\d+(\.\d{2})?$/.test(nextPart)) {
                            currentPart = currentPart.replace(/,$/, '') + nextPart;
                            i++;
                        }
                    }
                    
                    fixedParts.push(currentPart);
                    i++;
                }
                
                const importantParts = fixedParts.slice(0, 4);
                formattedLine = importantParts.join(' | ');
            } else {
                return null;
            }
        }
        
        // 🔥 最终检查和清理
        if (!formattedLine || formattedLine.trim().length < 2) {
            return null;
        }
        
        // 🔥 再次确保没有多余的空白和换行
        formattedLine = formattedLine.replace(/\s+/g, ' ').trim();
        
        // 🔥 长度控制 - 增加长度限制，避免重要信息被截断
        if (formattedLine.length > 300) {
            formattedLine = formattedLine.substring(0, 197) + '...';
        }
        
        // 不添加图标，只保留简单缩进
        return `  ${formattedLine}`;
    }

    // 统一的AI调用函数
    async callAI(prompt, callType = 'AI数据标注') {
        return await callYuanJingAI(prompt, callType);
    }

    // 获取统计信息
    getStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.config.maxCacheSize,
            config: this.config
        };
    }

    // 清理缓存
    clearCache() {
        this.cache.clear();
        console.log('🗑️ AI数据清洗缓存已清理');
    }
}

// 创建全局AI数据清洗器实例
const aiDataCleaner = new AIDataCleaner();

// 🔥 智能JSON解析器 - 整合三次解析逻辑
class SmartJSONParser {
    static parseAIResponse(text, context = 'AI响应') {
        console.log(`🔧 开始智能JSON解析 (${context})...`);
        
        // 第一阶段：预处理清理 
        let cleanedText = this.preprocessJSON(text);
        console.log('🔧 预处理后的JSON:', cleanedText.substring(0, 200) + '...');
        
        // 第二阶段：直接解析尝试
        let result = this.attemptDirectParse(cleanedText);
        if (result.success) {
            console.log('✅ 第一次解析成功！');
            return result.data;
        }
        
        // 第三阶段：修复后解析
        result = this.attemptFixedParse(cleanedText);
        if (result.success) {
            console.log('✅ 修复后解析成功！');
            return result.data;
        }
        
        // 第四阶段：正则提取（降级方案）
        result = this.attemptRegexExtraction(text);
        if (result.success) {
            console.log('✅ 正则提取成功！');
            return result.data;
        }
        
        // 全部失败
        console.error('❌ 所有JSON解析方法都失败了');
        throw new Error(`JSON解析失败: ${result.error}`);
    }
    
    // 预处理JSON文本
    static preprocessJSON(text) {
        return text
            // 移除markdown代码块
            .replace(/```json\s*/g, '').replace(/```\s*/g, '')
            // 移除注释
            .replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
            // 修复常见格式问题
            .replace(/,(\s*[\]}])/g, '$1')  // 移除多余逗号
            .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')  // 单引号 → 双引号
            .replace(/:\s*'([^']*)'(\s*[,}])/g, ': "$1"$2')
            // 修复数字格式
            .replace(/:\s*([0-9.]+)%/g, ': $1')
            .replace(/:\s*([0-9.]+),([0-9]+)/g, ': $1$2')
            // 修复中文标点
            .replace(/，/g, ',').replace(/：/g, ':').replace(/；/g, ';')
            // 统一引号
            .replace(/"/g, '"').replace(/"/g, '"')
            .replace(/'/g, "'").replace(/'/g, "'")
            // 修复属性名
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            // 清理空白
            .replace(/\s+/g, ' ').trim();
    }
    
    // 直接解析尝试
    static attemptDirectParse(text) {
        try {
            const data = JSON.parse(text);
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // 修复后解析
    static attemptFixedParse(text) {
        try {
            let fixedText = text
                // 更强的属性名修复
                .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
                // 修复字符串值缺少引号
                .replace(/:\s*([^",\[\]{}0-9null][^,}]*?)(?=[,}])/g, (match, content) => {
                    const trimmed = content.trim();
                    if (!trimmed.startsWith('"') && !trimmed.endsWith('"') && 
                        trimmed !== 'true' && trimmed !== 'false' && trimmed !== 'null') {
                        const escaped = trimmed.replace(/"/g, '\\"');
                        return `: "${escaped}"`;
                    }
                    return match;
                })
                // 修复特殊值
                .replace(/:\s*null\s*([,}])/g, ': null$1')
                .replace(/:\s*true\s*([,}])/g, ': true$1')
                .replace(/:\s*false\s*([,}])/g, ': false$1')
                // 修复数字
                .replace(/:\s*([0-9]+\.?[0-9]*)\s*([,}])/g, ': $1$2')
                // 最终清理
                .replace(/,(\s*[}\]])/g, '$1').trim();
            
            const data = JSON.parse(fixedText);
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // 正则提取（降级方案）
    static attemptRegexExtraction(text) {
        try {
            console.log('🔧 使用正则表达式提取关键信息...');
            
            const extractedData = {
                quotationCategory: this.extractField(text, 'quotationCategory', '其他'),
                quotationTitle: this.extractField(text, 'quotationTitle', '未识别产品'),
                supplier: this.extractField(text, 'supplier', '未知供应商'),
                region: this.extractField(text, 'region', null),
                totalPrice: this.extractNumericField(text, 'totalPrice'),
                discountedTotalPrice: this.extractNumericField(text, 'discountedTotalPrice'),
                unitPrice: this.extractNumericField(text, 'unitPrice'),
                quantity: this.extractIntegerField(text, 'quantity', 1),
                currency: this.extractField(text, 'currency', 'USD'),
                discount_rate: this.extractNumericField(text, 'discount_rate'),
                quote_validity: this.extractField(text, 'quote_validity', null),
                delivery_date: this.extractField(text, 'delivery_date', null),
                notes: this.extractField(text, 'notes', '')
            };
            
            return { success: true, data: [extractedData] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // 辅助方法：提取字符串字段
    static extractField(text, fieldName, defaultValue = null) {
        const pattern = new RegExp(`"${fieldName}":\\s*"([^"]*)"`, 'i');
        const match = text.match(pattern);
        return match ? match[1] : defaultValue;
    }
    
    // 辅助方法：提取数字字段
    static extractNumericField(text, fieldName) {
        const pattern = new RegExp(`"${fieldName}":\\s*([0-9.]+)`, 'i');
        const match = text.match(pattern);
        return match ? parseFloat(match[1]) : null;
    }
    
    // 辅助方法：提取整数字段
    static extractIntegerField(text, fieldName, defaultValue = null) {
        const pattern = new RegExp(`"${fieldName}":\\s*([0-9]+)`, 'i');
        const match = text.match(pattern);
        return match ? parseInt(match[1]) : defaultValue;
    }
}

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
            
            // 1. 提取结构化表格数据（新方法：保持行列对应关系）
            console.log('📋 步骤1: 提取结构化表格数据...');
            const tableResult = this.extractStructuredTableData(filePath);
            const tableContent = tableResult.structuredContent;
            console.log('✅ 结构化表格数据提取完成，内容长度:', tableContent.length, '字符');
            console.log(`📊 表格信息: ${tableResult.rowCount}行 × ${tableResult.columnCount}列, 表头: ${tableResult.hasHeader ? '有' : '无'}`);
            
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
            
            // 3. 合并结构化表格数据和OCR结果
            console.log('📋 步骤3: 合并结构化表格数据和OCR结果...');
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
                console.log('ℹ️ 未发现图片或OCR识别失败，仅使用结构化表格数据');
            }
            
            return {
                content: combinedContent,
                hasOCR: ocrResults.length > 0,
                ocrCount: ocrResults.length,
                tableContent: tableContent,
                ocrResults: ocrResults,
                // 🔥 新增：结构化表格信息
                tableStructure: {
                    hasHeader: tableResult.hasHeader,
                    headerRow: tableResult.headerRow,
                    rowCount: tableResult.rowCount,
                    columnCount: tableResult.columnCount,
                    isStructured: true
                }
            };
            
        } catch (error) {
            console.error('❌ Excel OCR处理失败:', error);
            console.error('错误详情:', error.message);
            console.error('错误堆栈:', error.stack);
            
            // 降级到仅表格处理
            try {
                console.log('🔄 降级到仅表格处理...');
                const tableResult = this.extractStructuredTableData(filePath);
                return {
                    content: tableResult.structuredContent,
                    hasOCR: false,
                    ocrCount: 0,
                    tableContent: tableResult.structuredContent,
                    error: error.message,
                    tableStructure: {
                        hasHeader: tableResult.hasHeader,
                        headerRow: tableResult.headerRow,
                        rowCount: tableResult.rowCount || 0,
                        columnCount: tableResult.columnCount || 0,
                        isStructured: true
                    }
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

    // 🔥 新增：提取保持行列对应关系的Excel表格数据
    extractStructuredTableData(filePath) {
        try {
            console.log('📊 开始提取结构化表格数据...');
            
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // 获取表格范围
            const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1:A1');
            console.log(`📋 表格范围: ${worksheet['!ref']}`);
            
            // 提取表格数据为二维数组
            const tableData = [];
            
            for (let row = range.s.r; row <= range.e.r; row++) {
                const rowData = [];
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
                    const cell = worksheet[cellAddress];
                    const cellValue = cell ? (cell.v || '') : '';
                    rowData.push(cellValue.toString().trim());
                }
                tableData.push(rowData);
            }
            
            console.log(`📊 提取了 ${tableData.length} 行 × ${tableData[0]?.length || 0} 列数据`);
            
            // 🔥 格式化为行列对应的文本格式
            const formattedLines = [];
            
            // 检测表头行
            const headerRow = tableData[0] || [];
            const hasHeader = headerRow.some(cell => 
                /^(PART|DESCRIPTION|PRICE|QTY|SKU|MODEL|BRAND)/i.test(cell) ||
                cell.length > 0
            );
            
            if (hasHeader) {
                console.log('📋 检测到表头行');
                formattedLines.push('=== 表格标题行 ===');
                formattedLines.push(headerRow.map((cell, index) => `列${index + 1}: ${cell}`).join(' | '));
                formattedLines.push('');
                formattedLines.push('=== 表格数据行 ===');
            }
            
            // 处理数据行（跳过空行和表头）
            const dataStartRow = hasHeader ? 1 : 0;
            for (let i = dataStartRow; i < tableData.length; i++) {
                const row = tableData[i];
                
                // 跳过完全空的行
                if (row.every(cell => !cell || cell.trim() === '')) {
                    continue;
                }
                
                // 🔥 格式化行数据，保持列对应关系
                const formattedRow = [];
                
                for (let j = 0; j < row.length; j++) {
                    const cellValue = row[j];
                    const columnHeader = hasHeader ? (headerRow[j] || `列${j + 1}`) : `列${j + 1}`;
                    
                    if (cellValue && cellValue.trim()) {
                        formattedRow.push(`${columnHeader}: ${cellValue}`);
                    }
                }
                
                if (formattedRow.length > 0) {
                    formattedLines.push(`行${i + 1}: ${formattedRow.join(' | ')}`);
                }
            }
            
            const structuredContent = formattedLines.join('\n');
            console.log(`✅ 结构化表格数据提取完成，内容长度: ${structuredContent.length} 字符`);
            
            return {
                structuredContent: structuredContent,
                rawTableData: tableData,
                hasHeader: hasHeader,
                headerRow: hasHeader ? headerRow : null,
                rowCount: tableData.length,
                columnCount: tableData[0]?.length || 0
            };
            
        } catch (error) {
            console.error('❌ 结构化表格数据提取失败:', error);
            // 降级到原始CSV方法
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            return {
                structuredContent: xlsx.utils.sheet_to_csv(worksheet),
                rawTableData: null,
                hasHeader: false,
                headerRow: null,
                error: error.message
            };
        }
    }
}

// 创建OCR处理器实例
const ocrProcessor = new ExcelOCRProcessor();

// 元景AI调用函数
async function callYuanJingAI(prompt, callType = '未知') {
    console.log(' 正在调用元景70B大模型...');
    
    // 🔥 新增：显示完整提示词
    console.log('📝 ========== AI提示词开始 ==========');
    console.log(prompt);
    console.log('📝 ========== AI提示词结束 ==========');
    console.log(`📊 提示词长度: ${prompt.length} 字符`);
    
    let responseContent = null;
    let duration = 0;
    
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
                temperature: 0.5,
                max_tokens: 10000, // 增加最大token数以处理更多内容
                top_p: 0.9,
                top_k: 50,
                repetition_penalty: 1.1,
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
        duration = endTime - startTime;
        
        console.log(`✅ 元景70B模型调用成功！耗时: ${duration}ms`);
        
        // 🔥 新增：显示AI响应内容
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const content = response.data.choices[0].message.content;
            console.log('🤖 ========== AI响应开始 ==========');
            console.log(content);
            console.log('🤖 ========== AI响应结束 ==========');
            console.log(`📊 响应长度: ${content ? content.length : 0} 字符`);
            
            if (content && content.trim()) {
                responseContent = content;
                
                // 🔥 记录成功的AI调用
                recordAICall(prompt, responseContent, duration, callType);
                
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
        
        // 🔥 记录失败的AI调用
        recordAICall(prompt, null, duration, callType);
        
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

// 🔥 新增：三步AI分析处理函数
const performThreeStepAIAnalysis = async (content, processingInfo, fileName, filePath, fileHash, ocrPromptAddition, enableDetailedAI = true) => {
    console.log('🔧 开始重构的三步AI处理流程...');
    console.log(`⚙️ 详细AI识别: ${enableDetailedAI ? '启用' : '仅基础识别'}`);
    
    // 确保processingInfo包含fileName信息
    const enhancedProcessingInfo = {
        ...processingInfo,
        fileName: fileName
    };
    
    // 🔥 步骤1：统一数据合并和行号分配
    console.log('📊 步骤1：统一数据合并和行号分配...');
    const mergedData = mergeAndAssignLineNumbers(enhancedProcessingInfo, content);
    
    // 🔥 步骤2：第一次AI - 基本信息提取
    console.log('🤖 步骤2：第一次AI - 基本信息提取...');
    console.log(`📊 用于AI基础分析的数据长度: ${mergedData.mergedContent.length} 字符`);
    
    const basicInfoPrompt = `你是一个专业的报价单分析专家。请仔细分析以下报价文件内容，专注于提取基础信息和价格信息。${ocrPromptAddition}

🔥 重要提示：
1. 必须返回标准的JSON数组格式，不要包含任何markdown标记或其他文字
2. 所有字符串值必须用双引号包围
3. 数字值不要加引号，百分号等符号也不要包含在数字值中
4. 只分析基础信息和价格信息，不要分析详细配置
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
-注意不要把配件当作主要产品名称，产品名称应该为关于服务器、存储、网络、安全、软件、云服务等设备名称，而不是下属配件名称!

🔍 主要产品识别规则：
- 服务器类：如 "HPE DL380 Gen11 Server"、"Dell PowerEdge R750"、"IBM Power10"以及更多
- 存储类：如 "HPE MSA 2060"、"NetApp FAS2750"、"Dell EMC PowerStore"
- 网络类：如 "Cisco Catalyst 9300"、"Aruba 6300"、"Juniper EX4650"
- 安全类：如 "Fortinet FortiGate 600E"、"Cisco ASA 5516"
- 软件类：如 "VMware vSphere"、"Microsoft Windows Server"
- 云服务：如 "AWS EC2"、"Azure Virtual Machine"

⚠️ 避免识别为主要设备的内容：
- CPU (如 Intel Xeon、AMD EPYC)
- 内存条 (如 DDR4、DDR5 Memory Kit)
- 硬盘 (如 SSD、HDD、Storage Drive)
- 网卡 (如 Network Adapter、NIC Card)
- 电源 (如 Power Supply、PSU)
- 风扇 (如 Fan Kit、Cooling)
- 线缆 (如 Cable、Cord)
- 控制器 (如 Controller Card、RAID Card)

如果报价单包含多个产品，应该识别主要的服务器/存储/网络设备名称，而不是其中的配件。

🏢 供应商识别（重要）：
- 供应商：实际提供报价的公司、经销商、代理商、服务商
- 制造商：产品品牌方（Dell、HP、Cisco、IBM、Microsoft、VMware、华为、联想等）
- 优先识别报价单抬头、公司信息、联系方式、签名处的公司名称作为供应商
- 如果只能识别到制造商品牌，供应商字段使用"未识别"

💰 价格术语识别：
原价相关：List Price、MSRP、标准价格、官方价格、零售价、原价
实际价格：Customer Price、Net Price、Final Price、折扣价格、成交价、实际价
单价相关：Unit Price、单价、每个、单位价格
总价相关: 总计、合计、Total Price、总金额
注意，总价识别一定是整份报价单的总价，而不是单个产品的总价！要结合整个报价单分析,一般总价都比单价高，如果单价很高，总价很低，则需要检查是否是单个产品的总价

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

请严格按照以下JSON格式返回基础信息和价格信息，不要包含任何其他文字：

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
    "quote_validity": "报价有效期（YYYY-MM-DD格式，没有则为null）",
    "delivery_date": "交付日期（YYYY-MM-DD格式，没有则为null）",
    "notes": "备注信息"
  }
]

**分析数据：**
${mergedData.mergedContent}`;

    let basicInfo = null;
    try {
        const aiResponse1 = await callYuanJingAI(basicInfoPrompt, '第一次AI-基础信息提取');
        basicInfo = SmartJSONParser.parseAIResponse(aiResponse1, 'AI基础信息分析');
        console.log('✅ 第一次AI基础信息提取完成');
    } catch (error) {
        console.error('❌ 第一次AI基础信息提取失败:', error);
        throw error;
    }
    
    // 🔥 步骤3：第二次AI - 识别有用行号（根据开关决定是否执行）
    if (!enableDetailedAI) {
        console.log('⚙️ 跳过详细AI识别，仅使用第一次AI的基础信息');
        return {
            basicInfo: basicInfo,
            detailedConfig: '', // 简易模式不生成详细配置
            annotation: null
        };
    }
    
    console.log('🤖 步骤3：第二次AI - 识别有用行号...');
    const annotation = await aiDataCleaner.annotateData(mergedData.mergedContent, 'excel');
    
    if (!annotation || !annotation.useful || annotation.useful.length === 0) {
        console.warn('⚠️ 没有识别到有用行，使用全部数据');
        const detailedConfig = mergedData.mergedContent;
        console.log(`📊 最终配置长度: ${detailedConfig.length} 字符`);
        
        return {
            basicInfo: basicInfo,
            detailedConfig: detailedConfig,
            annotation: null
        };
    }
    
    // 🔥 步骤4：第三次AI - 格式整理和OCR补全（修复版本）
    console.log('🤖 步骤4：第三次AI - 格式整理和OCR补全...');
    
    // 提取有用行的实际内容
    const usefulLines = [];
    const allLines = mergedData.mergedContent.split('\n');
    
    annotation.useful.forEach(lineNumber => {
        const lineIndex = lineNumber - 1;
        if (lineIndex >= 0 && lineIndex < allLines.length) {
            const line = allLines[lineIndex].trim();
            if (line) {
                usefulLines.push({
                    lineNumber: lineNumber,
                    content: line
                });
            }
        }
    });
    
    console.log(`📊 提取了 ${usefulLines.length} 行有用内容`);
    
    // 🔥 修复：如果没有有用行，使用全部数据
    if (usefulLines.length === 0) {
        console.warn('⚠️ 没有提取到有用行，使用全部数据');
        const detailedConfig = mergedData.mergedContent;
        console.log(`📊 最终配置长度: ${detailedConfig.length} 字符`);
        
        return {
            basicInfo: basicInfo,
            detailedConfig: detailedConfig,
            annotation: null
        };
    }
    
    // 第三次AI提示词：加强版格式整理
    const formatPrompt = `你是一个专业的ICT产品数据整理专家。请对以下有用行进行详细的格式整理

**有用行数据：**
${usefulLines.map(line => `行${line.lineNumber}: ${line.content}`).join('\n')}

**重要任务要求：**
使得以上配置的格式更加统一，更加清晰，更加完整，更加准确。

**重要提醒：**
- 不要省略任何内容，完整保留所有信息
- 重点修复OCR识别错误，使产品信息清晰可读
- 保持专业的ICT产品描述格式
- 不要添加不存在的信息，只修复和整理现有内容

请直接返回文本内容，不要使用JSON格式。`;

    let detailedConfig = '';
    try {
        const aiResponse3 = await callYuanJingAI(formatPrompt, '第三次AI-格式整理和OCR修复');
        detailedConfig = aiResponse3; // 直接使用AI输出，不做任何处理
        console.log('✅ 第三次AI格式整理完成');
        console.log(`📊 AI原始输出长度: ${detailedConfig.length} 字符`);
    } catch (error) {
        console.error('❌ 第三次AI格式整理失败:', error);
        // 降级处理：使用有用行的原始内容
        detailedConfig = usefulLines.map(line => `• ${line.content}`).join('\n');
        console.log(`📊 降级处理后配置长度: ${detailedConfig.length} 字符`);
    }
    
    // 🔥 确保配置信息不为空
    if (!detailedConfig || detailedConfig.trim().length === 0) {
        console.warn('⚠️ 配置信息为空，使用原始有用行');
        detailedConfig = usefulLines.map(line => `• ${line.content}`).join('\n');
    }
    
    console.log(`📊 最终配置长度: ${detailedConfig.length} 字符`);
    
    return {
        basicInfo: basicInfo,
        detailedConfig: detailedConfig,
        annotation: annotation
    };
};

// 🔥 新增：统一数据合并和行号分配函数
const mergeAndAssignLineNumbers = (processingInfo, content = null) => {
    console.log('📋 开始统一数据合并和行号分配...');
    
    const mergedLines = [];
    let currentLineNumber = 1;
    
    try {
        // 🔥 0. 处理直接传入的文本内容（PDF、Word等）
        if (content && typeof content === 'string' && content.trim().length > 0) {
            console.log('📄 合并直接文本内容 (PDF/Word等)...');
            
            const fileType = processingInfo.fileName ? 
                processingInfo.fileName.toLowerCase().split('.').pop() : 
                'unknown';
            
            mergedLines.push(`行${currentLineNumber}: === ${fileType.toUpperCase()}文件内容 ===`);
            currentLineNumber++;
            
            // 将内容按行分割并添加行号
            const contentLines = content.trim().split('\n');
            contentLines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && trimmedLine.length > 0) {
                    mergedLines.push(`行${currentLineNumber}: ${trimmedLine}`);
                    currentLineNumber++;
                }
            });
            
            console.log(`📄 添加了 ${contentLines.length} 行文本内容`);
        }
        // 1. 处理Excel表格数据（优化：保持结构化格式）
        if (processingInfo.tableContent) {
            console.log('📊 合并Excel表格数据...');
            
            // 🔥 检查是否为结构化表格数据
            const isStructuredTable = processingInfo.tableStructure?.isStructured;
            
            if (isStructuredTable) {
                console.log('📋 检测到结构化Excel表格数据，保持行列对应关系');
                mergedLines.push(`行${currentLineNumber}: === Excel结构化表格数据 ===`);
                currentLineNumber++;
                
                if (processingInfo.tableStructure.hasHeader) {
                    mergedLines.push(`行${currentLineNumber}: 表格规格: ${processingInfo.tableStructure.rowCount}行 × ${processingInfo.tableStructure.columnCount}列 (含表头)`);
                    currentLineNumber++;
                }
            } else {
                console.log('📋 处理传统CSV格式表格数据');
                mergedLines.push(`行${currentLineNumber}: === Excel表格数据 ===`);
                currentLineNumber++;
            }
            
            const tableLines = processingInfo.tableContent.split('\n');
            tableLines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && trimmedLine.length > 0) {
                    // 🔥 对于结构化数据，保持原有格式
                    if (isStructuredTable && trimmedLine.startsWith('行')) {
                        // 已经有行号的结构化数据，直接使用
                        mergedLines.push(trimmedLine);
                    } else if (isStructuredTable && (trimmedLine.startsWith('===') || trimmedLine.includes('列'))) {
                        // 表头和分隔符信息
                        mergedLines.push(`行${currentLineNumber}: ${trimmedLine}`);
                        currentLineNumber++;
                    } else {
                        // 普通数据行
                        mergedLines.push(`行${currentLineNumber}: ${trimmedLine}`);
                        currentLineNumber++;
                    }
                }
            });
        }
        
        // 2. 处理OCR结果（保持原有逻辑）
        if (processingInfo.ocrResults && processingInfo.ocrResults.length > 0) {
            console.log('🔍 合并OCR识别结果...');
            
            processingInfo.ocrResults.forEach((ocrResult, index) => {
                if (ocrResult && ocrResult.text && ocrResult.text.trim()) {
                    // 添加OCR图片标题
                    mergedLines.push(`行${currentLineNumber}: === 配置图片 ${index + 1} (OCR识别, 置信度: ${Math.round(ocrResult.confidence)}%) ===`);
                    currentLineNumber++;
                    
                    // 添加OCR识别的每一行
                    const ocrLines = ocrResult.text.trim().split('\n');
                    ocrLines.forEach(line => {
                        const trimmedLine = line.trim();
                        if (trimmedLine && trimmedLine.length > 0) {
                            mergedLines.push(`行${currentLineNumber}: ${trimmedLine}`);
                            currentLineNumber++;
                        }
                    });
                }
            });
        }
        
        const mergedContent = mergedLines.join('\n');
        console.log(`✅ 数据合并完成，总共 ${currentLineNumber - 1} 行`);
        
        // 🔥 输出结构化信息用于调试
        if (processingInfo.tableStructure?.isStructured) {
            console.log(`📊 结构化表格信息:`);
            console.log(`   - 行数: ${processingInfo.tableStructure.rowCount}`);
            console.log(`   - 列数: ${processingInfo.tableStructure.columnCount}`);
            console.log(`   - 表头: ${processingInfo.tableStructure.hasHeader ? '有' : '无'}`);
            if (processingInfo.tableStructure.headerRow) {
                console.log(`   - 表头内容: ${processingInfo.tableStructure.headerRow.join(' | ')}`);
            }
        }
        
        return {
            mergedContent: mergedContent,
            totalLines: currentLineNumber - 1,
            mergedLines: mergedLines,
            isStructured: processingInfo.tableStructure?.isStructured || false
        };
        
    } catch (error) {
        console.error('❌ 数据合并失败:', error);
        return {
            mergedContent: '数据合并失败',
            totalLines: 0,
            mergedLines: [],
            isStructured: false
        };
    }
};

// 🔥 新增：处理AI分析结果函数
const processAIAnalysisResult = async (analysisResult, fileName, filePath, fileHash) => {
    console.log('🔧 开始处理AI分析结果...');
    
    const { basicInfo, detailedConfig } = analysisResult;
    
    // 确保返回的是数组
    let products = Array.isArray(basicInfo) ? basicInfo : [basicInfo];
    
    // 处理AI分析结果
    const processedProducts = products.map(product => {
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
        
        // 智能价格处理逻辑
        const originalTotalPrice = cleanPrice(product.totalPrice) || 0;
        const discountedTotalPrice = cleanPrice(product.discountedTotalPrice);
        const unitPrice = cleanPrice(product.unitPrice);
        const quantity = cleanQuantity(product.quantity);
        let discountRate = cleanPrice(product.discount_rate);
        
        let finalTotalPrice = originalTotalPrice;
        let finalDiscountedPrice = discountedTotalPrice;
        let finalUnitPrice = unitPrice;
        
        // 智能计算单价和总价
        if (!finalUnitPrice && finalTotalPrice > 0 && quantity > 0) {
            finalUnitPrice = Math.round((finalTotalPrice / quantity) * 100) / 100;
        }
        
        if (!finalTotalPrice && finalUnitPrice > 0 && quantity > 0) {
            finalTotalPrice = finalUnitPrice * quantity;
        }
        
        // 计算折扣率
        if (finalTotalPrice > 0 && finalDiscountedPrice && finalDiscountedPrice < finalTotalPrice) {
            if (!discountRate) {
                discountRate = Math.round(((finalTotalPrice - finalDiscountedPrice) / finalTotalPrice) * 100);
            }
        } else if (!finalTotalPrice && finalDiscountedPrice) {
            finalTotalPrice = finalDiscountedPrice;
        }
        
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
        
        // 确保category字段有值并映射到正确的枚举值
        if (!product.quotationCategory) {
            product.quotationCategory = '其他';
        } else {
            const categoryMapping = {
                '服务器解决方案': '服务器',
                '存储解决方案': '存储设备', 
                '网络设备方案': '网络设备',
                '安全设备方案': '安全设备',
                '软件系统方案': '软件系统',
                '云服务方案': '云服务'
            };
            
            product.quotationCategory = categoryMapping[product.quotationCategory] || product.quotationCategory;
            
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
            list_price: finalTotalPrice,
            quote_unit_price: finalDiscountedPrice ? Math.round((finalDiscountedPrice / quantity) * 100) / 100 : finalUnitPrice,
            unit_price: finalUnitPrice,
            quantity: quantity,
            discount_rate: discountRate,
            quote_total_price: finalDiscountedPrice || finalTotalPrice,
            currency: product.currency || 'USD',
            
            // 详细信息 - 🔥 使用AI三步处理后的配置信息
            detailedComponents: detailedConfig ? aiDataCleaner.formatForDisplay(detailedConfig) : '',
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
                fileHash: fileHash,
                uploadedAt: new Date()
            }
        };
    });
    
    console.log(`✅ AI分析结果处理完成，产品数量: ${processedProducts.length}`);
    return processedProducts;
};

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
    const { fileName, filePath, enableDetailedAI = true } = req.body;
    
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
            console.log('📄 开始处理PDF文件...');
            try {
                const dataBuffer = await fs.readFile(fullPath);
                console.log(`📄 PDF文件读取成功，大小: ${dataBuffer.length} bytes`);
                
                const data = await pdf(dataBuffer);
                content = data.text;
                
                console.log(`📄 PDF文字提取完成，内容长度: ${content ? content.length : 0} 字符`);
                console.log(`📄 PDF页数: ${data.numpages || '未知'}`);
                
                if (!content || content.trim().length === 0) {
                    console.warn('⚠️ PDF文字提取结果为空，可能是图片PDF或受保护的PDF');
                    console.log('🔄 尝试使用OCR处理PDF...');
                    
                    // 尝试使用OCR处理PDF
                    try {
                        const ocrResult = await processPDFWithOCR(fullPath);
                        if (ocrResult.success && ocrResult.text) {
                            content = ocrResult.text;
                            processingInfo = {
                                hasOCR: true,
                                ocrCount: ocrResult.pageCount || 1,
                                ocrResults: ocrResult.results || [],
                                isPDFOCR: true
                            };
                            console.log(`✅ PDF OCR成功，提取文字: ${content.length} 字符`);
                        } else {
                            console.warn('⚠️ PDF OCR也失败，使用空内容继续');
                            content = '';
                        }
                    } catch (ocrError) {
                        console.warn('⚠️ PDF OCR处理失败:', ocrError.message);
                        console.log('💡 建议：如果是图片PDF，请转换为图片格式或使用专业OCR工具');
                        content = '';
                    }
                } else {
                    console.log(`📄 PDF前100字符预览: ${content.substring(0, 100)}...`);
                }
            } catch (pdfError) {
                console.error('❌ PDF处理失败:', pdfError);
                console.log('🔄 尝试按纯文本读取...');
                try {
                    content = await fs.readFile(fullPath, 'utf8');
                    console.log('📄 按纯文本读取成功');
                } catch (textError) {
                    console.error('❌ 纯文本读取也失败:', textError);
                    throw new Error(`PDF处理失败: ${pdfError.message}`);
                }
            }
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

🔥 重要：专注于基础信息和价格信息的识别！`;
        }
        
        // 🔥 调用新的三步AI处理流程
        console.log(`⚙️ AI详细识别开关: ${enableDetailedAI ? '开启' : '关闭'}`);
        const analysisResult = await performThreeStepAIAnalysis(content, processingInfo, fileName, filePath, fileHash, ocrPromptAddition, enableDetailedAI);
        
        // 处理AI分析结果
        const processedProducts = await processAIAnalysisResult(analysisResult, fileName, filePath, fileHash);
        
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 智能报价助手系统启动成功！`);
    console.log(`📡 端口: ${PORT}`);
    console.log(`🔗 访问地址: http://localhost:${PORT}`);
    console.log(`🤖 AI模型: ${YUANJING_CONFIG.model}`);
    console.log(`💾 数据库: ${MONGODB_URI}`);
    console.log(`📄 系统版本: v1.0.0`);
    console.log(`🧠 AI数据清洗器: 已初始化 (缓存: ${aiDataCleaner.config.maxCacheSize}条, 阈值: ${aiDataCleaner.config.minLinesForAI}行)`);
});

// 🔥 新增：AI调用记录存储
const aiCallHistory = [];
const MAX_HISTORY_SIZE = 10; // 保存最近10次调用记录

// 🔥 新增：记录AI调用的函数
function recordAICall(prompt, response, duration, callType = '未知') {
    const record = {
        timestamp: new Date().toISOString(),
        callType: callType,
        promptLength: prompt.length,
        responseLength: response ? response.length : 0,
        duration: duration,
        prompt: prompt,
        response: response,
        success: !!response
    };
    
    aiCallHistory.unshift(record); // 添加到开头
    
    // 保持历史记录大小
    if (aiCallHistory.length > MAX_HISTORY_SIZE) {
        aiCallHistory.splice(MAX_HISTORY_SIZE);
    }
    
    console.log(`📝 AI调用记录已保存 (类型: ${callType}, 总记录数: ${aiCallHistory.length})`);
}

// 🔥 新增：调试接口 - 查看AI调用历史
app.get('/api/debug/ai-calls', (req, res) => {
    try {
        const { index, type } = req.query;
        
        if (index !== undefined) {
            // 查看特定索引的调用记录
            const idx = parseInt(index);
            if (idx >= 0 && idx < aiCallHistory.length) {
                const record = aiCallHistory[idx];
                res.json({
                    success: true,
                    record: record,
                    message: `第${idx + 1}次AI调用记录 (${record.callType})`
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: '记录索引超出范围',
                    availableRange: `0-${aiCallHistory.length - 1}`
                });
            }
        } else {
            // 返回所有记录的摘要
            const summary = aiCallHistory.map((record, index) => ({
                index: index,
                timestamp: record.timestamp,
                callType: record.callType,
                promptLength: record.promptLength,
                responseLength: record.responseLength,
                duration: record.duration,
                success: record.success
            }));
            
            res.json({
                success: true,
                totalRecords: aiCallHistory.length,
                summary: summary,
                message: '使用 ?index=0 查看具体记录内容'
            });
        }
    } catch (error) {
        console.error('❌ 获取AI调用历史失败:', error);
        res.status(500).json({
            success: false,
            error: '获取记录失败',
            details: error.message
        });
    }
});

// 🔥 新增：调试接口 - 清空AI调用历史
app.delete('/api/debug/ai-calls', (req, res) => {
    try {
        const oldCount = aiCallHistory.length;
        aiCallHistory.length = 0; // 清空数组
        
        res.json({
            success: true,
            message: `已清空${oldCount}条AI调用记录`
        });
    } catch (error) {
        console.error('❌ 清空AI调用历史失败:', error);
        res.status(500).json({
            success: false,
            error: '清空记录失败',
            details: error.message
        });
    }
});
