const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
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
    supplier: {
        type: String,
        required: true,
        trim: true
    },
    
    // 价格信息
    list_price: {
        type: Number,
        min: 0
    },
    quote_unit_price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
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
        enum: ['美国', '中国', '韩国', '日本', '芬兰', '瑞典', '荷兰', '德国', '法国', '印度', '以色列', '加拿大', '澳大利亚', '台湾', '英国', '瑞士', '新加坡', '其他']
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

// 创建索引以提高查询性能
quotationSchema.index({ supplier: 1 });
quotationSchema.index({ productName: 1 });
quotationSchema.index({ category: 1 });
quotationSchema.index({ region: 1 });
quotationSchema.index({ quote_validity: 1 });
quotationSchema.index({ created_at: -1 });
quotationSchema.index({ status: 1 });

// 虚拟字段：计算折扣率
quotationSchema.virtual('calculatedDiscountRate').get(function() {
    if (this.list_price && this.quote_unit_price) {
        return ((this.list_price - this.quote_unit_price) / this.list_price * 100).toFixed(2);
    }
    return 0;
});

// 虚拟字段：检查是否过期
quotationSchema.virtual('isExpired').get(function() {
    return new Date() > this.quote_validity;
});

module.exports = mongoose.model('Quotation', quotationSchema); 