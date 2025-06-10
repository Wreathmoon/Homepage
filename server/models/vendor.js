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
        enum: ['服务器', '存储设备', '网络设备', '安全设备', '软件系统', '云服务', '其他']
    }],
    region: {
        type: String,
        enum: ['华北', '华东', '华南', '华中', '西南', '西北', '东北', '海外']
    },
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
    level: {
        type: String,
        enum: ['A', 'B', 'C'],
        default: 'B'
    },
    remarks: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['HARDWARE', 'SOFTWARE', 'SERVICE'],
        required: true
    },
    country: {
        type: String,
        required: true,
        trim: true
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
vendorSchema.index({ country: 1 });
vendorSchema.index({ type: 1 });
vendorSchema.index({ category: 1 });
vendorSchema.index({ brands: 1 });

module.exports = mongoose.model('Vendor', vendorSchema); 