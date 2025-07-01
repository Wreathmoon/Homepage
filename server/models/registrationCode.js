const mongoose = require('mongoose');

const registrationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    usedBy: {
        type: String,
        trim: true // 记录被哪个用户使用
    },
    usedAt: {
        type: Date
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 } // MongoDB自动删除过期文档
    },
    createdBy: {
        type: String,
        required: true,
        trim: true // 记录是哪个管理员生成的
    }
}, {
    timestamps: true
});

// 创建索引
registrationCodeSchema.index({ code: 1 });
registrationCodeSchema.index({ isUsed: 1 });
registrationCodeSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('RegistrationCode', registrationCodeSchema); 