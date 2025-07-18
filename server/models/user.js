const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    // 供应商编辑临时权限
    vendorEditable: {
        enabled: {
            type: Boolean,
            default: false
        },
        expiresAt: {
            type: Date,
            default: null
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: String,
        trim: true // 记录是哪个管理员创建的
    }
}, {
    timestamps: true
});

// 密码加密
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // 若已经是 bcrypt hash，跳过
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) {
    return next();
  }
  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const salt = await bcrypt.genSalt(saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// 实例方法：验证密码
userSchema.methods.comparePassword = async function(plainPassword) {
  // 判断存储值是否为 bcrypt hash
  const isHashed = this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$');
  if (isHashed) {
    return bcrypt.compare(plainPassword, this.password);
  }

  // 旧数据：明文密码
  const matched = plainPassword === this.password;
  if (matched) {
    // 升级为加密密码，异步保存但不影响当前登录流程
    try {
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
      const salt = await bcrypt.genSalt(saltRounds);
      this.password = await bcrypt.hash(plainPassword, salt);
      await this.save();
    } catch (err) {
      console.warn('密码升级加密失败:', err);
    }
  }
  return matched;
};

// 创建索引
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema); 