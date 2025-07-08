const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    // 供应商名称（中文）
    chineseName: {
        type: String,
        required: true,
        trim: true
    },
    // 供应商名称（英文，可选）
    englishName: {
        type: String,
        trim: true
    },
    // 向后兼容旧字段 name（映射到中文名）
    name: {
        type: String,
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
    // 多地区支持
    regions: [{
        type: String,
        trim: true
    }],
    // 向后兼容单个地区字段
    region: {
        type: String,
        trim: true
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
    // 最后修改人
    modifiedBy: {
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