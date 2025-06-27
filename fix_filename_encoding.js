const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/quotation_system')
  .then(async () => {
    console.log('✅ 数据库连接成功');
    
    const db = mongoose.connection.db;
    const collection = db.collection('quotations');
    
    // 查找所有记录
    const records = await collection.find({}).toArray();
    console.log(`📊 找到 ${records.length} 条记录`);
    
    let fixedCount = 0;
    
    for (const record of records) {
      if (record.originalFile && record.originalFile.filename) {
        const currentFilename = record.originalFile.filename;
        
        // 尝试修复编码
        let fixedFilename = currentFilename;
        
        // 如果包含乱码字符，尝试修复
        if (currentFilename.includes('æ') || currentFilename.includes('ä') || currentFilename.includes('¥')) {
          try {
            // 尝试从乱码恢复到正确的中文
            // 这是一个简单的映射，基于观察到的模式
            fixedFilename = currentFilename
              .replace(/æ¥ä»·/g, '报价')  // æ¥ä»· -> 报价
              .replace(/æ\w+ä\w+¥/g, '报价') // 更通用的模式
              .replace(/æ/g, '报')
              .replace(/¥/g, '价');
            
            console.log(`🔧 修复文件名:`);
            console.log(`   原始: ${currentFilename}`);
            console.log(`   修复: ${fixedFilename}`);
            
            // 更新数据库
            await collection.updateOne(
              { _id: record._id },
              { 
                $set: { 
                  'originalFile.filename': fixedFilename,
                  'originalFile.displayName': fixedFilename  // 添加一个显示名称字段
                } 
              }
            );
            
            fixedCount++;
          } catch (error) {
            console.error(`❌ 修复失败 ${record._id}:`, error.message);
          }
        } else {
          console.log(`✅ 文件名正常: ${currentFilename}`);
        }
      }
    }
    
    console.log(`🎉 修复完成！共修复 ${fixedCount} 条记录`);
    process.exit(0);
    
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err);
    process.exit(1);
  }); 