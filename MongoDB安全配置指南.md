# MongoDB 安全配置指南

## 🚨 当前安全状态

**⚠️ 警告**: 目前数据库没有启用身份验证，任何人都可以连接！

检测结果：
- ❌ 未启用身份验证
- ❌ 没有管理员用户
- ❌ 没有访问控制

## 🔒 安全配置步骤

### 第一步：创建管理员用户

在启用认证之前，我们需要先创建管理员用户：

```bash
# 连接到admin数据库
mongosh mongodb://localhost:27017/admin

# 创建数据库管理员
db.createUser({
  user: "dbadmin",
  pwd: "Strong_Password_123!",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})
```

### 第二步：创建应用程序用户

```bash
# 切换到应用数据库
use quotation_system

# 创建应用程序专用用户
db.createUser({
  user: "quotation_app",
  pwd: "App_Password_456!",
  roles: [
    { role: "readWrite", db: "quotation_system" }
  ]
})
```

### 第三步：启用认证

#### 方法一：修改配置文件 (推荐)

1. 找到MongoDB配置文件 (通常在):
   - Windows: `C:\Program Files\MongoDB\Server\[version]\bin\mongod.cfg`
   - Linux/Mac: `/etc/mongod.conf`

2. 添加或修改以下配置：
```yaml
security:
  authorization: enabled
```

3. 重启MongoDB服务：
```bash
# Windows
net stop MongoDB
net start MongoDB

# Linux/Mac
sudo systemctl restart mongod
```

#### 方法二：启动时添加参数

```bash
mongod --auth --dbpath /data/db
```

### 第四步：验证认证配置

```bash
# 尝试未认证连接 (应该失败)
mongosh mongodb://localhost:27017/quotation_system --eval "db.users.find()"

# 使用认证连接 (应该成功)
mongosh mongodb://quotation_app:App_Password_456!@localhost:27017/quotation_system --eval "db.users.find()"
```

## 🔧 修改应用程序配置

### 更新环境变量

修改 `server/.env` 文件：

```env
# 原来的连接 (不安全)
# MONGODB_URI=mongodb://localhost:27017/quotation_system

# 新的安全连接
MONGODB_URI=mongodb://quotation_app:App_Password_456!@localhost:27017/quotation_system
```

### 更新连接字符串格式

```javascript
// 基本格式
mongodb://username:password@host:port/database

// 完整示例
mongodb://quotation_app:App_Password_456!@localhost:27017/quotation_system

// 如果密码包含特殊字符，需要URL编码
mongodb://quotation_app:App_Password_456%21@localhost:27017/quotation_system
```

## 👨‍💼 用户角色说明

### 数据库管理员 (dbadmin)
- **用途**: 数据库维护、用户管理
- **权限**: 
  - 创建/删除用户
  - 备份/恢复数据库
  - 查看所有数据库
  - 系统管理

### 应用程序用户 (quotation_app)
- **用途**: 应用程序连接数据库
- **权限**:
  - 读写 quotation_system 数据库
  - 无法访问其他数据库
  - 无法创建用户

## 🛡️ 安全最佳实践

### 1. 密码策略
- ✅ 至少12位字符
- ✅ 包含大小写字母、数字、特殊字符
- ✅ 定期更换密码
- ✅ 不要在代码中硬编码密码

### 2. 网络安全
```yaml
# 限制绑定IP (mongod.cfg)
net:
  bindIp: 127.0.0.1,192.168.1.100  # 只允许特定IP
  port: 27017
```

### 3. SSL/TLS 加密 (生产环境)
```yaml
net:
  ssl:
    mode: requireSSL
    PEMKeyFile: /path/to/mongodb.pem
```

### 4. 审计日志
```yaml
auditLog:
  destination: file
  format: JSON
  path: /var/log/mongodb/audit.json
```

## 🔄 密码管理

### 更改用户密码
```javascript
// 连接为管理员
mongosh mongodb://dbadmin:Strong_Password_123!@localhost:27017/admin

// 更改应用用户密码
db.changeUserPassword("quotation_app", "New_App_Password_789!")

// 更改管理员密码
db.changeUserPassword("dbadmin", "New_Admin_Password_456!")
```

### 删除用户
```javascript
// 删除用户
db.dropUser("username")

// 查看所有用户
db.getUsers()
```

## 📋 连接测试脚本

创建 `test-connection.js`:

```javascript
const mongoose = require('mongoose');

async function testConnection() {
    try {
        // 安全连接
        await mongoose.connect('mongodb://quotation_app:App_Password_456!@localhost:27017/quotation_system');
        console.log('✅ 数据库连接成功 (已认证)');
        
        // 测试操作
        const collections = await mongoose.connection.db.collections();
        console.log('📋 可访问的集合:', collections.map(c => c.collectionName));
        
    } catch (error) {
        console.error('❌ 连接失败:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

testConnection();
```

## 🚨 紧急恢复

如果忘记密码或配置错误：

### 1. 禁用认证
```bash
# 停止MongoDB
net stop MongoDB

# 无认证启动
mongod --noauth --dbpath /data/db

# 重置用户或密码
mongosh mongodb://localhost:27017/admin
db.changeUserPassword("dbadmin", "newpassword")

# 重新启用认证
```

### 2. 单用户模式
```bash
mongod --auth --setParameter authenticationMechanisms=SCRAM-SHA-1 --dbpath /data/db
```

## 📊 安全检查清单

- [ ] 创建了管理员用户
- [ ] 创建了应用程序用户  
- [ ] 启用了身份验证
- [ ] 更新了应用程序连接字符串
- [ ] 测试了连接
- [ ] 限制了网络访问
- [ ] 设置了强密码
- [ ] 配置了日志记录
- [ ] 备份了配置文件

## ⚡ 快速实施脚本

保存为 `setup-security.js`:

```javascript
// 连接到未认证的MongoDB (最后一次)
mongosh mongodb://localhost:27017/admin --eval "
// 创建管理员
db.createUser({
  user: 'dbadmin',
  pwd: 'Strong_Password_123!',
  roles: [
    {role: 'userAdminAnyDatabase', db: 'admin'},
    {role: 'dbAdminAnyDatabase', db: 'admin'},
    {role: 'readWriteAnyDatabase', db: 'admin'}
  ]
});

// 切换到应用数据库
use quotation_system;

// 创建应用用户
db.createUser({
  user: 'quotation_app',
  pwd: 'App_Password_456!',
  roles: [{role: 'readWrite', db: 'quotation_system'}]
});

print('✅ 用户创建完成，请启用认证并重启MongoDB');
"
```

现在您的数据库将拥有完整的权限保护！ 