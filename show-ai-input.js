const xlsx = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

// 模拟我们系统中的extractDetailedComponents函数
function extractDetailedComponents(content, processingInfo) {
    console.log('📋 开始提取详细配置信息...');
    let detailedComponents = '';
    
    try {
        // 专门处理CSV/Excel数据的函数
        const processCSVData = (csvContent) => {
            console.log('📊 处理CSV格式数据...');
            const lines = csvContent.split('\n');
            const configLines = [];
            
            for (const line of lines) {
                const cleanLine = line.trim();
                
                // 跳过空行和只包含逗号的行
                if (!cleanLine || cleanLine.match(/^,+$/)) {
                    continue;
                }
                
                // 分割CSV行
                const fields = cleanLine.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
                
                // 过滤掉全部为空或只包含数字/价格的行
                const nonEmptyFields = fields.filter(field => 
                    field && 
                    field.length > 1 && 
                    !field.match(/^\d+[\.,]?\d*$/) && // 纯数字
                    !field.match(/^[\$€¥£]\d/) && // 价格
                    !field.match(/^[0-9\.,\s]+$/) && // 数字组合
                    field !== '0' &&
                    field !== '0.00'
                );
                
                if (nonEmptyFields.length === 0) {
                    continue;
                }
                
                // 查找产品型号和描述
                for (let i = 0; i < fields.length; i++) {
                    const field = fields[i];
                    if (!field || field.length < 3) continue;
                    
                    // 检测产品型号模式 (如 P52534-B21, INT Xeon-G 等)
                    if (field.match(/^[A-Z0-9][\w\-]+[A-Z0-9]$/i) && field.length > 5) {
                        // 获取对应的产品描述
                        let description = '';
                        for (let j = i + 1; j < Math.min(i + 4, fields.length); j++) {
                            if (fields[j] && fields[j].length > 10 && 
                                !fields[j].match(/^\d+[\.,]?\d*$/) &&
                                !fields[j].match(/^[\$€¥£]/)) {
                                description = fields[j];
                                break;
                            }
                        }
                        
                        if (description) {
                            const productLine = `- ${field}: ${description}`;
                            if (!configLines.includes(productLine)) {
                                configLines.push(productLine);
                            }
                        }
                    }
                    // 检测产品描述模式 (包含关键词的长文本)
                    else if (field.length > 10 && 
                            (field.includes('HPE') || field.includes('Intel') || field.includes('CPU') ||
                             field.includes('Memory') || field.includes('Storage') || field.includes('SSD') ||
                             field.includes('HDD') || field.includes('Controller') || field.includes('Adapter') ||
                             field.includes('Kit') || field.includes('Server') || field.includes('Gen11') ||
                             field.includes('Network') || field.includes('Power') || field.includes('Management'))) {
                        
                        // 查找对应的型号
                        let partNumber = '';
                        for (let j = Math.max(0, i - 3); j < i; j++) {
                            if (fields[j] && fields[j].match(/^[A-Z0-9][\w\-]+[A-Z0-9]$/i)) {
                                partNumber = fields[j];
                                break;
                            }
                        }
                        
                        const productLine = partNumber ? 
                            `- ${partNumber}: ${field}` : 
                            `- ${field}`;
                        
                        if (!configLines.includes(productLine)) {
                            configLines.push(productLine);
                        }
                    }
                }
            }
            
            console.log(`✅ 从CSV中提取了 ${configLines.length} 行产品配置`);
            return configLines.join('\n');
        };
        
        // 1. 优先处理Excel表格数据
        if (processingInfo.tableContent) {
            console.log('📊 处理Excel表格数据...');
            const csvResult = processCSVData(processingInfo.tableContent);
            if (csvResult) {
                detailedComponents += csvResult;
            }
        }
        
        // 2. 如果没有表格数据，处理原始内容
        if (!detailedComponents && content) {
            console.log('📄 处理原始内容...');
            const contentLines = content.split('\n');
            const configLines = [];
            
            for (const line of contentLines) {
                const cleanLine = line.trim();
                if (cleanLine && 
                    cleanLine.length > 5 &&
                    !cleanLine.toLowerCase().includes('price') &&
                    !cleanLine.toLowerCase().includes('total') &&
                    !cleanLine.toLowerCase().includes('amount') &&
                    !cleanLine.match(/^\d+[\.,]\d+/) &&
                    (cleanLine.includes('HPE') || cleanLine.includes('Intel') ||
                     cleanLine.includes('CPU') || cleanLine.includes('Memory') ||
                     cleanLine.includes('Storage') || cleanLine.includes('Network') ||
                     cleanLine.includes('Server') || cleanLine.length > 20)) {
                    configLines.push(`- ${cleanLine}`);
                }
            }
            
            if (configLines.length > 0) {
                detailedComponents = configLines.slice(0, 30).join('\n');
            }
        }
        
        // 限制总长度
        if (detailedComponents.length > 5000) {
            detailedComponents = detailedComponents.substring(0, 5000) + '\n\n[配置信息过长，已截断...]';
        }
        
        return detailedComponents || '未能提取到详细配置信息';
        
    } catch (error) {
        console.error('❌ 提取详细配置信息失败:', error);
        return '配置信息提取失败: ' + error.message;
    }
}

async function showAIInput() {
    console.log('🤖 ===== AI实际接收到的内容 =====\n');
    
    const uploadsDir = './uploads';
    const files = await fs.readdir(uploadsDir);
    const excelFiles = files.filter(file => 
        file.toLowerCase().endsWith('.xlsx') || file.toLowerCase().endsWith('.xls')
    );
    
    if (excelFiles.length === 0) {
        console.log('❌ 没有找到Excel文件');
        return;
    }
    
    const targetFile = excelFiles[0];
    const filePath = path.join(uploadsDir, targetFile);
    
    console.log(`🎯 分析文件: ${targetFile}\n`);
    
    // 1. 模拟Excel处理过程
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const tableContent = xlsx.utils.sheet_to_csv(worksheet);
    
    // 2. 模拟处理信息
    const processingInfo = {
        hasOCR: true, // 假设有OCR
        ocrCount: 2,
        tableContent: tableContent,
        ocrResults: [
            {
                text: "HPE DL380 Gen11 Server Configuration\nProcessor: Intel Xeon Gold 5418Y\nMemory: 32GB DDR5\nStorage: 480GB SSD + 1.8TB HDD\nNetwork: 10GbE Adapter\nPower: 1000W Redundant PSU",
                confidence: 85,
                originalName: "image1.jpeg"
            },
            {
                text: "Network Topology Diagram\nManagement Network: 192.168.1.0/24\nProduction Network: 10.0.0.0/16\nSwitch: HPE Aruba 6300M\nFirewall: FortiGate 600E",
                confidence: 78,
                originalName: "image2.png"
            }
        ]
    };
    
    // 3. 提取详细配置信息
    const detailedComponents = extractDetailedComponents(tableContent, processingInfo);
    
    // 4. 生成AI提示词
    const ocrPromptAddition = `

⚠️ 特别说明：此文件包含图片内容，已通过OCR技术识别
- 表格数据：自动提取的结构化数据（如果有Excel表格）
- 图片内容：通过OCR识别的详细信息（共${processingInfo.ocrCount}个图片）
- 请综合分析所有可用数据源，包括表格数据和OCR识别的图片内容
- 如果是纯图片报价单，主要依赖OCR识别结果
- 如果OCR内容与表格数据有冲突，优先使用更完整、更详细的数据源

OCR识别质量说明：
${processingInfo.ocrResults.map((r, i) => 
    `- 图片${i+1}: 置信度${Math.round(r.confidence)}% ${r.confidence > 80 ? '(高质量)' : r.confidence > 60 ? '(中等质量)' : '(低质量，请谨慎使用)'}`
).join('\n')}

🔥 重要：专注于基础信息和价格信息的识别！`;

    const prompt = `你是一个专业的报价单分析专家。请仔细分析以下报价文件内容，专注于提取基础信息和价格信息。${ocrPromptAddition}

🔥 重要提示：
1. 必须返回标准的JSON数组格式，不要包含任何markdown标记或其他文字
2. 所有字符串值必须用双引号包围
3. 数字值不要加引号，百分号等符号也不要包含在数字值中
4. 只分析基础信息和价格信息，不要分析详细配置
5. 所有属性名必须用双引号包围
6. 字符串内容中的特殊字符需要转义

[JSON格式要求和产品识别规则省略...]

文件内容：
${tableContent}`;

    // 5. 显示AI实际看到的内容
    console.log('📄 ===== 1. 原始CSV表格数据 =====');
    console.log('─'.repeat(80));
    const lines = tableContent.split('\n');
    lines.slice(0, 30).forEach((line, index) => {
        if (line.trim()) {
            console.log(`${(index + 1).toString().padStart(3)}: ${line.substring(0, 120)}${line.length > 120 ? '...' : ''}`);
        }
    });
    if (lines.length > 30) {
        console.log(`... (还有 ${lines.length - 30} 行)`);
    }
    console.log('─'.repeat(80));
    
    console.log('\n🔧 ===== 2. 提取的详细配置信息 =====');
    console.log('─'.repeat(80));
    console.log(detailedComponents);
    console.log('─'.repeat(80));
    
    console.log('\n🖼️ ===== 3. OCR识别的图片内容 =====');
    console.log('─'.repeat(80));
    processingInfo.ocrResults.forEach((result, index) => {
        console.log(`\n--- 图片 ${index + 1} (置信度: ${Math.round(result.confidence)}%) ---`);
        console.log(`原始文件: ${result.originalName}`);
        console.log(`识别内容:\n${result.text}`);
    });
    console.log('─'.repeat(80));
    
    console.log('\n🤖 ===== 4. 发送给AI的完整提示词 =====');
    console.log('─'.repeat(80));
    console.log(prompt.substring(0, 2000));
    if (prompt.length > 2000) {
        console.log(`\n... [提示词过长，总长度: ${prompt.length} 字符，已截取前2000字符]`);
    }
    console.log('─'.repeat(80));
    
    console.log('\n📊 ===== 内容统计 =====');
    console.log(`原始CSV长度: ${tableContent.length} 字符`);
    console.log(`详细配置长度: ${detailedComponents.length} 字符`);
    console.log(`OCR内容总长度: ${processingInfo.ocrResults.reduce((sum, r) => sum + r.text.length, 0)} 字符`);
    console.log(`完整提示词长度: ${prompt.length} 字符`);
    console.log(`图片数量: ${processingInfo.ocrCount} 个`);
}

showAIInput().catch(console.error); 