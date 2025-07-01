const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../env.example') });

// 导入模型
const Vendor = require('../models/vendor');
const Quotation = require('../models/quotation');
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
    {
        username: 'user',
        password: '123456',
        displayName: '普通用户',
        role: 'user',
        createdBy: 'system'
    }
];

// 供应商数据
const vendorsData = [
    {
        name: '北京科技有限公司',
        code: 'BJ001',
        category: ['服务器', '存储设备'],
        region: '中国',
        contact: '张三',
        phone: '13800138000',
        email: 'zhangsan@example.com',
        address: '北京市海淀区中关村科技园',
        status: 'active',
        type: 'HARDWARE',
        website: 'http://www.bjtech.com',
        brands: ['联想', '浪潮'],
        isGeneralAgent: true,
        isAgent: false,
        account: 'zhangsan',
        password: 'password123'
    },
    {
        name: '上海网络科技公司',
        code: 'SH001',
        category: ['网络设备', '安全设备'],
        region: '中国',
        contact: '李四',
        phone: '13900139000',
        email: 'lisi@example.com',
        address: '上海市浦东新区张江高科技园区',
        status: 'active',
        type: 'HARDWARE',
        website: 'http://www.shnetwork.com',
        brands: ['华为', 'H3C'],
        isGeneralAgent: false,
        isAgent: true,
        account: 'lisi',
        password: 'password456'
    },
    {
        name: 'American Software Solutions',
        code: 'US001',
        category: ['软件系统', '云服务'],
        region: '美国',
        contact: 'John Smith',
        phone: '+1-123-456-7890',
        email: 'john@example.com',
        address: '123 Tech Street, Silicon Valley',
        status: 'active',
        type: 'SOFTWARE',
        website: 'http://www.ussoftware.com',
        brands: ['Microsoft', 'Oracle'],
        isGeneralAgent: true,
        isAgent: false,
        account: 'john',
        password: 'password789'
    },
    {
        name: '深圳智能科技有限公司',
        code: 'SZ001',
        category: ['安全设备', '网络设备'],
        region: '中国',
        contact: '王五',
        phone: '13700137000',
        email: 'wangwu@example.com',
        address: '深圳市南山区科技园',
        status: 'active',
        type: 'SERVICE',
        website: 'http://www.sztech.com',
        brands: ['深信服', '绿盟'],
        isGeneralAgent: false,
        isAgent: true,
        account: 'wangwu',
        password: 'password101'
    },
    {
        name: 'European Tech Solutions',
        code: 'EU001',
        category: ['软件系统', '服务器'],
        region: '德国',
        contact: 'Hans Mueller',
        phone: '+49-89-1234-5678',
        email: 'hans@eurotech.com',
        address: 'Munich Technology Center, Germany',
        status: 'active',
        type: 'HARDWARE',
        website: 'http://www.eurotech-solutions.com',
        brands: ['SAP', 'Siemens'],
        isGeneralAgent: true,
        isAgent: false,
        account: 'hans',
        password: 'password555'
    }
];

// 报价数据
const quotationsData = [
    {
        name: 'Dell PowerEdge R750服务器',
        productName: 'Dell PowerEdge R750服务器',
        category: '服务器',
        supplier: '北京科技有限公司',
        region: '中国',
        unitPrice: 25000,
        quantity: 2,
        totalPrice: 50000,
        finalPrice: 48000,
        quotationDate: '2024-01-15',
        validUntil: '2024-02-15',
        remarks: '包含3年原厂保修'
    },
    {
        name: 'HPE MSA存储阵列',
        productName: 'HPE MSA存储阵列',
        category: '存储设备',
        supplier: '上海网络科技公司',
        region: '中国',
        unitPrice: 15000,
        quantity: 1,
        totalPrice: 15000,
        finalPrice: 14500,
        quotationDate: '2024-01-16',
        validUntil: '2024-02-16',
        remarks: '含安装调试服务'
    },
    {
        name: 'Microsoft Office 365企业版',
        productName: 'Microsoft Office 365企业版',
        category: '软件系统',
        supplier: 'American Software Solutions',
        region: '美国',
        unitPrice: 120,
        quantity: 100,
        totalPrice: 12000,
        finalPrice: 11000,
        quotationDate: '2024-01-17',
        validUntil: '2024-02-17',
        remarks: '年度订阅，包含技术支持'
    },
    {
        name: 'Cisco交换机',
        productName: 'Cisco交换机',
        category: '网络设备',
        supplier: '深圳智能科技有限公司',
        region: '中国',
        unitPrice: 8000,
        quantity: 3,
        totalPrice: 24000,
        finalPrice: 22800,
        quotationDate: '2024-01-18',
        validUntil: '2024-02-18',
        remarks: '24端口千兆交换机'
    }
];

async function seedDatabase() {
    try {
        // 连接数据库
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation_system');
        console.log('✅ 数据库连接成功');

        // 清空现有数据 (谨慎操作)
        console.log('🧹 清理现有数据...');
        await User.deleteMany({});
        await Vendor.deleteMany({});
        await Quotation.deleteMany({});

        // 插入用户数据
        console.log('📝 插入用户数据...');
        const users = await User.insertMany(usersData);
        console.log(`✅ 成功插入 ${users.length} 个用户`);

        // 插入供应商数据
        console.log('📝 插入供应商数据...');
        const vendors = await Vendor.insertMany(vendorsData);
        console.log(`✅ 成功插入 ${vendors.length} 个供应商`);

        // 临时注释掉报价数据插入
        // console.log('📝 插入报价数据...');
        // const quotations = await Quotation.insertMany(quotationsData);
        // console.log(`✅ 成功插入 ${quotations.length} 条报价记录`);

        console.log('\n🎉 数据初始化完成！');
        console.log('📊 数据统计:');
        console.log(`   - 用户: ${users.length} 个`);
        console.log(`   - 供应商: ${vendors.length} 个`);
        // console.log(`   - 报价记录: ${quotations.length} 条`);
        console.log(`   - 数据库: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation_system'}`);

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

module.exports = { seedDatabase, vendorsData, quotationsData }; 