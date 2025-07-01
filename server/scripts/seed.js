const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../env.example') });

// 导入模型
const User = require('../models/user');

// 用户数据
const usersData = [
    {
        username: 'CHINAUNICOM_ADMIN',
        password: 'admin_password01!',
        displayName: '管理员',
        role: 'admin',
        createdBy: 'system'
    },
];


async function seedDatabase() {
    try {
        // 连接数据库
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://quotation_app:QuotationApp_2024!@localhost:27017/quotation_system');
        console.log('✅ 数据库连接成功');

        // 清空现有数据 (谨慎操作)
        console.log('🧹 清理现有数据...');
        await User.deleteMany({});

        // 插入用户数
        console.log('📝 插入用户数据...');
        const users = await User.insertMany(usersData);
        console.log(`✅ 成功插入 ${users.length} 个用户`);
        // console.log('📝 插入报价数据...');
        // const quotations = await Quotation.insertMany(quotationsData);
        // console.log(`✅ 成功插入 ${quotations.length} 条报价记录`);

        console.log('\n🎉 数据初始化完成！');
        console.log('📊 数据统计:');
        console.log(`   - 用户: ${users.length} 个`);
    } catch (error) {
        console.error('❌ 数据初始化失败:', error);
        process.exit(1);
    } finally {
        // 关闭数据库连接
        await mongoose.connection.close();
        console.log('🔌 数据库连接已关闭');
        process.exit(0);
    }
}

// 运行初始化
if (require.main === module) {
    seedDatabase();
}
