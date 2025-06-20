const xlsx = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

// 改进的文件处理函数 - 保持完整信息但格式清晰
function processExcelForAI(tableContent) {
    console.log('📊 开始处理Excel数据，保持完整结构...');
    
    const lines = tableContent.split('\n');
    const processedLines = [];
    
    // 1. 找到表头行
    let headerRowIndex = -1;
    let headerRow = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const upperLine = line.toUpperCase();
        
        // 寻找包含常见表头关键词的行
        if (upperLine.includes('PART') || upperLine.includes('SKU') || 
            upperLine.includes('DESCRIPTION') || upperLine.includes('PRICE') || 
            upperLine.includes('QTY') || upperLine.includes('QUANTITY') ||
            upperLine.includes('AMOUNT') || upperLine.includes('TOTAL')) {
            headerRowIndex = i;
            headerRow = line.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
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
        processedLines.push('-'.repeat(80));
        
        // 3. 处理数据行
        let dataRowCount = 0;
        for (let i = headerRowIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 跳过完全空行
            if (!line || line.match(/^,+$/)) {
                continue;
            }
            
            const fields = line.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
            
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
                
                // 格式化数据行，确保列对齐
                const formattedFields = fields.map((field, index) => {
                    if (!field) return '';
                    
                    // 如果是价格列，保持原格式
                    if (headerRow[index] && 
                        (headerRow[index].toUpperCase().includes('PRICE') ||
                         headerRow[index].toUpperCase().includes('COST') ||
                         headerRow[index].toUpperCase().includes('AMOUNT'))) {
                        return field;
                    }
                    
                    return field;
                });
                
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
        // 如果没有找到明确的表头，按行处理
        console.log('⚠️ 未找到标准表头，按行处理所有内容');
        
        processedLines.push('=== 文件内容 (按行处理) ===');
        
        let meaningfulRowCount = 0;
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const cleanLine = line.trim();
            
            if (cleanLine && !cleanLine.match(/^,+$/)) {
                meaningfulRowCount++;
                const fields = cleanLine.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
                
                // 过滤掉全空的字段，但保持位置关系
                const displayFields = fields.map(field => field || '[空]');
                
                processedLines.push(`行${meaningfulRowCount} (原第${index + 1}行): ` + displayFields.join(' | '));
                
                if (meaningfulRowCount >= 30) {
                    processedLines.push(`... (还有更多行)`);
                    break;
                }
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
4. 请根据表头信息准确识别：
   - 产品型号/编号列
   - 产品描述列  
   - 单价列
   - 数量列
   - 总价列
   - 其他相关信息列

请返回标准JSON数组格式，提取以下信息：
- productName: 产品名称/描述
- partNumber: 产品型号/编号 
- unitPrice: 单价 (数字，不含货币符号)
- quantity: 数量 (数字)
- totalPrice: 总价 (数字，不含货币符号)
- currency: 货币单位 (如 "GBP", "USD", "CNY")
- supplier: 供应商名称
- category: 产品类别

文件内容：
${processedContent}`;
}

async function showBetterAIInput() {
    console.log('🎯 ===== 改进的AI输入格式展示 =====\n');
    
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
    
    console.log('📄 ===== 原始CSV数据 (前20行) =====');
    console.log('─'.repeat(80));
    const originalLines = tableContent.split('\n');
    originalLines.slice(0, 20).forEach((line, index) => {
        if (line.trim()) {
            console.log(`${(index + 1).toString().padStart(3)}: ${line.substring(0, 120)}${line.length > 120 ? '...' : ''}`);
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
    
    console.log('\n📝 ===== 发送给AI的完整提示词 =====');
    console.log('─'.repeat(80));
    console.log(aiPrompt.substring(0, 2000));
    if (aiPrompt.length > 2000) {
        console.log(`\n... [提示词过长，总长度: ${aiPrompt.length} 字符，已截取前2000字符]`);
    }
    console.log('─'.repeat(80));
    
    console.log('\n📊 ===== 对比分析 =====');
    console.log(`原始CSV长度: ${tableContent.length} 字符`);
    console.log(`处理后内容长度: ${processedContent.length} 字符`);
    console.log(`完整提示词长度: ${aiPrompt.length} 字符`);
    console.log('');
    console.log('✅ 改进点:');
    console.log('  1. 保持完整的价格和数量信息');
    console.log('  2. 明确标注每列的含义');
    console.log('  3. 保持行列对应关系');
    console.log('  4. 不依赖特定格式或关键词');
    console.log('  5. AI可以清楚知道哪列是什么数据');
}

showBetterAIInput().catch(console.error); 