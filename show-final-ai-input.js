const xlsx = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

// 正确解析CSV行，处理引号包围的字段
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // 双引号转义
                current += '"';
                i++; // 跳过下一个引号
            } else {
                // 切换引号状态
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // 字段分隔符
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // 添加最后一个字段
    fields.push(current.trim());
    
    return fields;
}

// 改进的Excel处理函数
function processExcelForAI(tableContent) {
    console.log('📊 开始处理Excel数据，保持完整结构...');
    
    const lines = tableContent.split('\n');
    const processedLines = [];
    
    // 1. 智能识别表头
    let headerRowIndex = -1;
    let headerRow = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const upperLine = line.toUpperCase();
        
        // 寻找包含常见表头关键词的行
        if (upperLine.includes('PART') || upperLine.includes('SKU') || 
            upperLine.includes('DESCRIPTION') || upperLine.includes('描述') ||
            upperLine.includes('PRICE') || upperLine.includes('单价') ||
            upperLine.includes('QTY') || upperLine.includes('数量') ||
            upperLine.includes('AMOUNT') || upperLine.includes('合计') ||
            upperLine.includes('TOTAL') || upperLine.includes('总计')) {
            headerRowIndex = i;
            headerRow = parseCSVLine(line);
            break;
        }
    }
    
    // 2. 处理表头信息
    if (headerRowIndex !== -1) {
        console.log(`✅ 找到表头行 (第${headerRowIndex + 1}行)`);
        
        // 添加表头说明
        processedLines.push('=== 报价单表头结构 ===');
        headerRow.forEach((header, index) => {
            if (header && header.trim()) {
                processedLines.push(`列${index + 1}: ${header.trim()}`);
            }
        });
        processedLines.push('');
        
        // 添加格式化的表头行
        processedLines.push('=== 表格数据 ===');
        processedLines.push('表头: ' + headerRow.join(' | '));
        processedLines.push('-'.repeat(100));
        
        // 3. 处理数据行
        let dataRowCount = 0;
        for (let i = headerRowIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 跳过完全空行
            if (!line || line.match(/^,+$/)) {
                continue;
            }
            
            const fields = parseCSVLine(line);
            
            // 检查是否是有意义的数据行
            const hasContent = fields.some(field => 
                field && 
                field.length > 0 && 
                field !== '0' && 
                field !== '0.00' &&
                !field.match(/^,+$/)
            );
            
            if (hasContent) {
                dataRowCount++;
                
                // 格式化数据行，保持原始格式
                const formattedFields = fields.map(field => field || '[空]');
                
                processedLines.push(`行${dataRowCount}: ` + formattedFields.join(' | '));
                
                // 限制显示行数，避免过长
                if (dataRowCount >= 50) {
                    processedLines.push(`... (还有 ${lines.length - headerRowIndex - 1 - dataRowCount} 行数据)`);
                    break;
                }
            }
        }
        
        console.log(`✅ 处理了 ${dataRowCount} 行有效数据`);
        
    } else {
        // 如果没有找到明确的表头，智能处理第一行作为表头
        console.log('⚠️ 未找到标准表头，将第一行作为表头处理');
        
        if (lines.length > 0) {
            const firstLine = lines[0].trim();
            if (firstLine) {
                const firstRowFields = parseCSVLine(firstLine);
                
                processedLines.push('=== 报价单表头结构 ===');
                firstRowFields.forEach((header, index) => {
                    if (header && header.trim()) {
                        processedLines.push(`列${index + 1}: ${header.trim()}`);
                    }
                });
                processedLines.push('');
                
                processedLines.push('=== 表格数据 ===');
                processedLines.push('表头: ' + firstRowFields.join(' | '));
                processedLines.push('-'.repeat(100));
                
                // 处理数据行
                let dataRowCount = 0;
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    if (!line || line.match(/^,+$/)) {
                        continue;
                    }
                    
                    const fields = parseCSVLine(line);
                    const hasContent = fields.some(field => field && field.length > 0);
                    
                    if (hasContent) {
                        dataRowCount++;
                        const formattedFields = fields.map(field => field || '[空]');
                        processedLines.push(`行${dataRowCount}: ` + formattedFields.join(' | '));
                        
                        if (dataRowCount >= 30) {
                            processedLines.push(`... (还有更多行)`);
                            break;
                        }
                    }
                }
                
                console.log(`✅ 处理了 ${dataRowCount} 行有效数据`);
            }
        }
    }
    
    return processedLines.join('\n');
}

// 生成AI提示词
function generateAIPrompt(processedContent, fileName) {
    return `你是一个专业的报价单分析专家。请仔细分析以下报价文件内容。

文件名: ${fileName}

重要说明：
1. 以下内容是从Excel文件中提取的完整表格数据
2. 表头结构已经标注，请注意每列的含义
3. 数据按行列格式组织，保持了原始的对应关系
4. 每行数据都与表头列一一对应
5. 请根据表头信息准确识别各列的含义

请返回标准JSON数组格式，提取以下信息：
- productName: 产品名称/描述
- partNumber: 产品型号/编号 (如果有)
- unitPrice: 单价 (数字，不含货币符号)
- quantity: 数量 (数字)
- totalPrice: 总价 (数字，不含货币符号)
- currency: 货币单位 (如 "GBP", "USD", "CNY")
- supplier: 供应商名称 (如果能识别)
- category: 产品类别 (如果能识别)

文件内容：
${processedContent}`;
}

async function showFinalAIInput() {
    console.log('🎯 ===== 最终版AI输入格式展示 =====\n');
    
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
    
    // 1. 读取Excel文件
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const tableContent = xlsx.utils.sheet_to_csv(worksheet);
    
    console.log('📄 ===== 原始CSV数据 =====');
    console.log('─'.repeat(80));
    const originalLines = tableContent.split('\n');
    originalLines.forEach((line, index) => {
        if (line.trim()) {
            console.log(`${(index + 1).toString().padStart(3)}: ${line}`);
        }
    });
    console.log('─'.repeat(80));
    
    // 2. 处理成AI友好的格式
    const processedContent = processExcelForAI(tableContent);
    
    console.log('\n🤖 ===== AI实际接收的格式化内容 =====');
    console.log('─'.repeat(80));
    console.log(processedContent);
    console.log('─'.repeat(80));
    
    // 3. 生成完整的AI提示词
    const aiPrompt = generateAIPrompt(processedContent, targetFile);
    
    console.log('\n📝 ===== 发送给AI的完整提示词 (前1500字符) =====');
    console.log('─'.repeat(80));
    console.log(aiPrompt.substring(0, 1500));
    if (aiPrompt.length > 1500) {
        console.log(`\n... [提示词过长，总长度: ${aiPrompt.length} 字符]`);
    }
    console.log('─'.repeat(80));
    
    console.log('\n📊 ===== 最终对比分析 =====');
    console.log(`原始CSV长度: ${tableContent.length} 字符`);
    console.log(`处理后内容长度: ${processedContent.length} 字符`);
    console.log(`完整提示词长度: ${aiPrompt.length} 字符`);
    console.log('');
    console.log('✅ 最终方案优势:');
    console.log('  1. 正确解析CSV引号，价格不会被错误分割');
    console.log('  2. 保持完整的价格和数量信息');
    console.log('  3. 明确标注每列的含义');
    console.log('  4. 保持行列对应关系');
    console.log('  5. 支持中英文表头识别');
    console.log('  6. 不依赖特定格式，通用性强');
    console.log('  7. AI可以清楚知道每列对应什么数据');
}

showFinalAIInput().catch(console.error); 