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
        trim: true
        // 移除enum限制，允许自定义地区
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
        wechat: {
            type: String,
            trim: true
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
        required: true,
        trim: true
        // 移除enum限制，允许自定义供应商类型
    },
    website: {
        type: String,
        trim: true
    },
    brands: [{
        type: String,
        trim: true
    }],
    // 新的代理资质字段
    agentType: {
        type: String,
        trim: true
        // 允许自定义代理资质
    },
    // 向后兼容字段
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
    },
    // 录入人和录入时间信息
    entryPerson: {
        type: String,
        trim: true
    },
    entryTime: {
        type: Date,
        default: Date.now
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