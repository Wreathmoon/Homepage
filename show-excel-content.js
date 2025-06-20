const xlsx = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

async function showExcelContent() {
    console.log('📊 ===== Excel内容详细展示 =====\n');
    
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
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 转换为CSV格式
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);
    
    console.log('📄 ===== 完整CSV内容 =====');
    console.log('─'.repeat(80));
    
    const lines = csvContent.split('\n');
    lines.forEach((line, index) => {
        if (line.trim()) { // 只显示非空行
            const lineNumber = (index + 1).toString().padStart(3);
            const displayLine = line.length > 150 ? line.substring(0, 150) + '...' : line;
            console.log(`${lineNumber}: ${displayLine}`);
        }
    });
    
    console.log('─'.repeat(80));
    console.log(`总行数: ${lines.length}, 非空行数: ${lines.filter(l => l.trim()).length}`);
    
    // 分析数据结构
    console.log('\n📊 ===== 数据结构分析 =====');
    
    // 查找表头行
    let headerRowIndex = -1;
    let headerRow = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('PART NUMBER') || line.includes('DESCRIPTION') || 
            line.includes('PRICE') || line.includes('QTY')) {
            headerRowIndex = i;
            headerRow = line.split(',');
            break;
        }
    }
    
    if (headerRowIndex !== -1) {
        console.log(`🎯 找到表头行 (第${headerRowIndex + 1}行):`);
        headerRow.forEach((header, index) => {
            if (header.trim()) {
                console.log(`  列${index + 1}: ${header.trim()}`);
            }
        });
        
        console.log('\n📋 ===== 产品数据行 =====');
        let productCount = 0;
        
        for (let i = headerRowIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() && !line.match(/^,+$/)) { // 非空且不是纯逗号的行
                const fields = line.split(',');
                
                // 检查是否是有效的产品行
                const hasPartNumber = fields[0] && fields[0].trim() && 
                                    !fields[0].toLowerCase().includes('total') &&
                                    !fields[0].toLowerCase().includes('subtotal');
                
                if (hasPartNumber) {
                    productCount++;
                    console.log(`\n产品 ${productCount} (第${i + 1}行):`);
                    
                    fields.forEach((field, fieldIndex) => {
                        if (field && field.trim() && fieldIndex < headerRow.length) {
                            const headerName = headerRow[fieldIndex] ? headerRow[fieldIndex].trim() : `列${fieldIndex + 1}`;
                            console.log(`  ${headerName}: ${field.trim()}`);
                        }
                    });
                    
                    if (productCount >= 10) { // 只显示前10个产品
                        console.log(`\n... (还有更多产品，共 ${lines.length - headerRowIndex - 1} 行数据)`);
                        break;
                    }
                }
            }
        }
        
        console.log(`\n📊 产品统计: 找到 ${productCount} 个有效产品记录`);
    } else {
        console.log('⚠️ 未找到明确的表头行，显示所有有意义的数据行:');
        
        let meaningfulLines = 0;
        lines.forEach((line, index) => {
            if (line.trim() && !line.match(/^,+$/) && line.split(',').some(field => field.trim().length > 2)) {
                meaningfulLines++;
                if (meaningfulLines <= 20) { // 只显示前20行有意义的数据
                    console.log(`\n第${index + 1}行:`);
                    const fields = line.split(',');
                    fields.forEach((field, fieldIndex) => {
                        if (field && field.trim()) {
                            console.log(`  列${fieldIndex + 1}: ${field.trim()}`);
                        }
                    });
                }
            }
        });
        
        if (meaningfulLines > 20) {
            console.log(`\n... (还有 ${meaningfulLines - 20} 行有意义的数据)`);
        }
    }
    
    // 分析价格和数量信息
    console.log('\n💰 ===== 价格和数量分析 =====');
    
    const pricePattern = /[\d,]+\.?\d*/;
    const currencyPattern = /[£$€¥]/;
    
    let priceFields = [];
    let quantityFields = [];
    
    lines.forEach((line, lineIndex) => {
        if (line.trim()) {
            const fields = line.split(',');
            fields.forEach((field, fieldIndex) => {
                const cleanField = field.trim();
                
                // 检查价格字段
                if (currencyPattern.test(cleanField) || 
                    (pricePattern.test(cleanField) && 
                     (line.toLowerCase().includes('price') || line.toLowerCase().includes('cost')))) {
                    priceFields.push({
                        line: lineIndex + 1,
                        column: fieldIndex + 1,
                        value: cleanField,
                        context: line.substring(0, 100)
                    });
                }
                
                // 检查数量字段
                if (cleanField.match(/^\d+$/) && parseInt(cleanField) > 0 && parseInt(cleanField) < 1000) {
                    quantityFields.push({
                        line: lineIndex + 1,
                        column: fieldIndex + 1,
                        value: cleanField,
                        context: line.substring(0, 100)
                    });
                }
            });
        }
    });
    
    console.log(`💰 发现 ${priceFields.length} 个可能的价格字段:`);
    priceFields.slice(0, 10).forEach((price, index) => {
        console.log(`  ${index + 1}. 第${price.line}行第${price.column}列: ${price.value}`);
    });
    
    console.log(`\n📦 发现 ${quantityFields.length} 个可能的数量字段:`);
    quantityFields.slice(0, 10).forEach((qty, index) => {
        console.log(`  ${index + 1}. 第${qty.line}行第${qty.column}列: ${qty.value}`);
    });
}

showExcelContent().catch(console.error); 