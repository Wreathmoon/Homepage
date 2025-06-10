const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../env.example') });

// 导入模型
const Vendor = require('../models/vendor');
const Quotation = require('../models/quotation');

// 示例供应商数据
const sampleVendors = [
    {
        name: '北京科技有限公司',
        code: 'BJ001',
        category: ['服务器', '存储设备'],
        region: '华北',
        contact: '张三',
        phone: '13800138000',
        email: 'zhangsan@bjtech.com',
        address: '北京市海淀区中关村科技园',
        status: 'active',
        level: 'A',
        remarks: '战略合作伙伴，长期合作关系',
        type: 'HARDWARE',
        country: '中国',
        website: 'http://www.bjtech.com',
        brands: ['联想', '浪潮', '华为'],
        isGeneralAgent: true,
        isAgent: false,
        account: 'zhangsan',
        password: 'password123'
    },
    {
        name: '上海网络科技公司',
        code: 'SH001',
        category: ['网络设备', '安全设备'],
        region: '华东',
        contact: '李四',
        phone: '13900139000',
        email: 'lisi@shnetwork.com',
        address: '上海市浦东新区张江高科技园区',
        status: 'active',
        level: 'B',
        type: 'HARDWARE',
        country: '中国',
        website: 'http://www.shnetwork.com',
        brands: ['华为', 'H3C', '锐捷'],
        isGeneralAgent: false,
        isAgent: true,
        account: 'lisi',
        password: 'password456'
    },
    {
        name: 'American Software Solutions',
        code: 'US001',
        category: ['软件系统', '云服务'],
        region: '海外',
        contact: 'John Smith',
        phone: '+1-123-456-7890',
        email: 'john@ussoftware.com',
        address: '123 Tech Street, Silicon Valley, CA',
        status: 'active',
        level: 'A',
        type: 'SOFTWARE',
        country: '美国',
        website: 'http://www.ussoftware.com',
        brands: ['Microsoft', 'Oracle', 'VMware'],
        isGeneralAgent: true,
        isAgent: false,
        account: 'john',
        password: 'password789'
    },
    {
        name: '深圳智能科技有限公司',
        code: 'SZ001',
        category: ['安全设备', '网络设备'],
        region: '华南',
        contact: '王五',
        phone: '13700137000',
        email: 'wangwu@sztech.com',
        address: '深圳市南山区科技园',
        status: 'active',
        level: 'B',
        type: 'SERVICE',
        country: '中国',
        website: 'http://www.sztech.com',
        brands: ['深信服', '绿盟', '奇安信'],
        isGeneralAgent: false,
        isAgent: true,
        account: 'wangwu',
        password: 'password101'
    },
    {
        name: 'European Tech Solutions',
        code: 'EU001',
        category: ['服务器', '存储设备', '网络设备'],
        region: '海外',
        contact: 'Maria García',
        phone: '+49-30-12345678',
        email: 'maria@eurotech.com',
        address: 'Friedrichstraße 123, Berlin, Germany',
        status: 'active',
        level: 'A',
        type: 'HARDWARE',
        country: '德国',
        website: 'http://www.eurotech.com',
        brands: ['Dell', 'HPE', 'Cisco'],
        isGeneralAgent: true,
        isAgent: false,
        account: 'maria',
        password: 'password202'
    }
];

// 示例报价数据
const sampleQuotations = [
    {
        productName: 'Dell PowerEdge R750 服务器',
        name: 'Dell PowerEdge R750 服务器',
        supplier: '北京科技有限公司',
        list_price: 25000,
        quote_unit_price: 22000,
        quantity: 5,
        quote_total_price: 110000,
        currency: 'CNY',
        quote_validity: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60天后
        delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
        configDetail: '2U机架服务器，Intel Xeon Silver 4314 2.4GHz，32GB DDR4内存，1TB SSD硬盘，双电源',
        category: '服务器',
        region: '华北',
        status: 'active',
        endUser: {
            name: '上海分公司',
            address: '上海市浦东新区',
            contact: '张经理',
            contactInfo: '13800138001'
        },
        notes: '包含3年现场维保服务'
    },
    {
        productName: 'HPE MSA 2060 存储阵列',
        name: 'HPE MSA 2060 存储阵列',
        supplier: '上海网络科技公司',
        list_price: 35000,
        quote_unit_price: 31500,
        quantity: 2,
        quote_total_price: 63000,
        currency: 'CNY',
        quote_validity: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        delivery_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        configDetail: '12Gb SAS存储阵列，24个2.5英寸硬盘槽，双控制器，支持SSD和HDD混合配置',
        category: '存储设备',
        region: '华东',
        status: 'active',
        endUser: {
            name: '北京总部',
            address: '北京市海淀区',
            contact: '李经理',
            contactInfo: '13900139001'
        },
        notes: '包含安装调试和培训服务'
    },
    {
        productName: 'Microsoft Office 365 企业版',
        name: 'Microsoft Office 365 企业版',
        supplier: 'American Software Solutions',
        list_price: 150,
        quote_unit_price: 135,
        quantity: 1000,
        quote_total_price: 135000,
        currency: 'USD',
        quote_validity: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        configDetail: 'Office 365 E3企业版，包含Word、Excel、PowerPoint、Outlook、Teams等全套办公软件',
        category: '软件系统',
        region: '海外',
        status: 'active',
        endUser: {
            name: '全国各分公司',
            address: '全国',
            contact: 'IT部门',
            contactInfo: '400-1234567'
        },
        notes: '年度订阅，包含技术支持和培训'
    },
    {
        productName: 'Cisco Catalyst 9300 交换机',
        name: 'Cisco Catalyst 9300 交换机',
        supplier: '深圳智能科技有限公司',
        list_price: 15000,
        quote_unit_price: 13500,
        quantity: 10,
        quote_total_price: 135000,
        currency: 'CNY',
        quote_validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        delivery_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        configDetail: '48端口千兆以太网交换机，支持PoE+，4个10G SFP+上行端口，Layer 3功能',
        category: '网络设备',
        region: '华南',
        status: 'active',
        endUser: {
            name: '广州分公司',
            address: '广州市天河区',
            contact: '网络部',
            contactInfo: '020-12345678'
        },
        notes: '包含标准保修和基础配置服务'
    }
];

async function seedDatabase() {
    try {
        // 连接数据库
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation_system');
        console.log('✅ 数据库连接成功');

        // 清空现有数据 (谨慎操作)
        console.log('🧹 清理现有数据...');
        await Vendor.deleteMany({});
        await Quotation.deleteMany({});

        // 插入供应商数据
        console.log('📝 插入供应商数据...');
        const vendors = await Vendor.insertMany(sampleVendors);
        console.log(`✅ 成功插入 ${vendors.length} 个供应商`);

        // 插入报价数据
        console.log('📝 插入报价数据...');
        const quotations = await Quotation.insertMany(sampleQuotations);
        console.log(`✅ 成功插入 ${quotations.length} 条报价记录`);

        console.log('\n🎉 数据初始化完成！');
        console.log('📊 数据统计:');
        console.log(`   - 供应商: ${vendors.length} 个`);
        console.log(`   - 报价记录: ${quotations.length} 条`);
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

module.exports = { seedDatabase, sampleVendors, sampleQuotations }; 