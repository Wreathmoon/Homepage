# 智能报价助手 MongoDB 数据库管理指南

## 数据库连接状态

✅ **数据库已成功连接**
- 数据库名称：`quotation_system`
- 连接地址：`mongodb://localhost:27017/quotation_system`
- MongoDB Shell版本：`2.5.2`

## 数据库结构

当前数据库包含以下集合：

### 📋 集合列表
- **users** - 用户账号管理
- **vendors** - 供应商信息
- **quotations** - 报价记录
- **registrationcodes** - 注册码管理

## MongoDB 直接管理方法

### 1. 使用 MongoDB Shell (mongosh)

#### 连接数据库
```bash
mongosh mongodb://localhost:27017/quotation_system
```

#### 基本操作命令
```javascript
// 查看所有集合
show collections

// 查看数据库状态
db.stats()

// 查看某个集合的文档数量
db.users.countDocuments()
db.vendors.countDocuments()
db.quotations.countDocuments()
db.registrationcodes.countDocuments()
```

### 2. 用户管理操作

#### 查看所有用户
```javascript
db.users.find().pretty()
```

#### 查看特定用户
```javascript
// 按用户名查找
db.users.findOne({username: "CHINAUNICOM_ADMIN"})

// 按角色查找
db.users.find({role: "admin"}).pretty()
```

#### 修改用户信息
```javascript
// 修改用户密码
db.users.updateOne(
    {username: "CHINAUNICOM_ADMIN"}, 
    {$set: {password: "新密码"}}
)

// 修改用户角色
db.users.updateOne(
    {username: "用户名"}, 
    {$set: {role: "admin"}}
)

// 禁用用户
db.users.updateOne(
    {username: "用户名"}, 
    {$set: {isActive: false}}
)
```

#### 创建新管理员
```javascript
db.users.insertOne({
    username: "新管理员用户名",
    password: "密码",
    displayName: "管理员显示名",
    role: "admin",
    isActive: true,
    createdBy: "system",
    createdAt: new Date(),
    updatedAt: new Date()
})
```

#### 删除用户
```javascript
db.users.deleteOne({username: "要删除的用户名"})
```

### 3. 注册码管理

#### 查看所有注册码
```javascript
db.registrationcodes.find().pretty()
```

#### 查看未使用的注册码
```javascript
db.registrationcodes.find({
    isUsed: false,
    expiresAt: {$gt: new Date()}
}).pretty()
```

#### 手动创建注册码
```javascript
// 创建24小时有效的注册码
var expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 1);

db.registrationcodes.insertOne({
    code: "ABCD1234", // 8位注册码
    isUsed: false,
    expiresAt: expiresAt,
    createdBy: "CHINAUNICOM_ADMIN",
    createdAt: new Date()
})
```

#### 删除过期注册码
```javascript
db.registrationcodes.deleteMany({
    expiresAt: {$lt: new Date()}
})
```

### 4. 供应商管理

#### 查看所有供应商
```javascript
db.vendors.find().pretty()
```

#### 按条件查找供应商
```javascript
// 按名称查找
db.vendors.find({name: /关键字/i}).pretty()

// 按类型查找
db.vendors.find({type: "HARDWARE"}).pretty()

// 按地区查找
db.vendors.find({region: "中国"}).pretty()
```

#### 批量更新供应商
```javascript
// 给所有供应商添加录入人信息
db.vendors.updateMany(
    {entryPerson: {$exists: false}}, 
    {$set: {entryPerson: "系统管理员", entryTime: new Date()}}
)
```

### 5. 报价记录管理

#### 查看报价记录
```javascript
db.quotations.find().limit(10).pretty()
```

#### 统计报价信息
```javascript
// 按供应商统计报价数量
db.quotations.aggregate([
    {$group: {_id: "$vendor", count: {$sum: 1}}},
    {$sort: {count: -1}}
])

// 按产品类别统计
db.quotations.aggregate([
    {$group: {_id: "$category", count: {$sum: 1}}},
    {$sort: {count: -1}}
])
```

## 3. 使用 MongoDB Compass (图形界面)

如果您安装了 MongoDB Compass，可以通过图形界面管理：

1. 打开 MongoDB Compass
2. 连接字符串：`mongodb://localhost:27017`
3. 选择数据库：`quotation_system`
4. 可视化操作各个集合

## 4. 数据备份与恢复

### 备份数据库
```bash
# 备份整个数据库
mongodump --db quotation_system --out backup/

# 备份特定集合
mongodump --db quotation_system --collection users --out backup/
```

### 恢复数据库
```bash
# 恢复整个数据库
mongorestore --db quotation_system backup/quotation_system/

# 恢复特定集合
mongorestore --db quotation_system --collection users backup/quotation_system/users.bson
```

## 5. 常用维护操作

### 清理数据
```javascript
// 清理过期注册码
db.registrationcodes.deleteMany({
    expiresAt: {$lt: new Date()}
})

// 清理无效用户
db.users.deleteMany({isActive: false})
```

### 数据统计
```javascript
// 系统概览
print("=== 系统数据统计 ===")
print("用户总数:", db.users.countDocuments())
print("活跃用户:", db.users.countDocuments({isActive: true}))
print("管理员数量:", db.users.countDocuments({role: "admin"}))
print("供应商总数:", db.vendors.countDocuments())
print("报价记录:", db.quotations.countDocuments())
print("有效注册码:", db.registrationcodes.countDocuments({
    isUsed: false, 
    expiresAt: {$gt: new Date()}
}))
```

### 重建索引
```javascript
// 为用户名创建唯一索引
db.users.createIndex({username: 1}, {unique: true})

// 为注册码创建索引
db.registrationcodes.createIndex({code: 1}, {unique: true})
db.registrationcodes.createIndex({expiresAt: 1}, {expireAfterSeconds: 0})
```

## 6. 安全注意事项

1. **备份重要**：定期备份数据库
2. **权限控制**：生产环境建议设置数据库用户权限
3. **密码安全**：避免在命令行中直接输入密码
4. **操作确认**：删除操作前请务必确认
5. **日志监控**：关注数据库操作日志

## 7. 快速管理脚本

您可以在 `server` 目录创建管理脚本：

```bash
cd server
node -e "
const mongoose = require('mongoose');
const User = require('./models/user');

mongoose.connect('mongodb://localhost:27017/quotation_system').then(async () => {
    // 在这里写管理代码
    const users = await User.find();
    console.log('用户列表:', users);
    process.exit(0);
});
"
```

现在您可以通过以上任何方式直接管理MongoDB数据库！建议优先使用应用程序界面进行管理，MongoDB直接操作主要用于维护和故障排除。 