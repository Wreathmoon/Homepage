const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
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
        trim: true
        // 移除enum限制，允许自定义产品类别
    }],
    region: {
        type: String,
        enum: ['美国', '中国', '韩国', '日本', '芬兰', '瑞典', '荷兰', '德国', '法国', '印度', '以色列', '加拿大', '澳大利亚', '台湾', '英国', '瑞士', '新加坡', '其他']
    },
    // 多个联系人信息
    contacts: [{
        name: {
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
        position: {
            type: String,
            trim: true
        },
        remarks: {
            type: String,
            trim: true
        },
        isPrimary: {
            type: Boolean,
            default: false
        }
    }],
    // 向后兼容字段
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
    remarks: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['HARDWARE', 'SOFTWARE', 'SERVICE', 'DATACENTER'],
        required: true
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
    timestamps: true // 自动添加 createdAt 和 updatedAt
});

// 创建索引以提高查询性能
vendorSchema.index({ name: 1 });
vendorSchema.index({ region: 1 });
vendorSchema.index({ type: 1 });
vendorSchema.index({ category: 1 });
vendorSchema.index({ brands: 1 });

module.exports = mongoose.model('Vendor', vendorSchema); 