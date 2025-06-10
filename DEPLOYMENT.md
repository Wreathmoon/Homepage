# 部署说明 - 报价助手 v0.1.5

## 🚀 主要功能
- Excel文件上传与解析
- Gemini AI智能识别报价内容  
- SQLite数据库自动存储
- 前端表格展示与编辑

## 📋 部署前准备

### 1. 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 2. 环境变量配置
创建 `.env` 文件：
```env
# 前端API配置
REACT_APP_API_URL=http://localhost:3001/api

# Gemini AI API配置
GEMINI_API_KEY=your_gemini_api_key_here

# 服务器端口配置
PORT=3001
```

### 3. 安装依赖
```bash
npm install
```

## 🛠️ 本地开发

### 启动开发服务器
```bash
# 同时启动前端和后端
npm run dev

# 或分别启动
npm run server  # 后端服务器 (端口3001)
npm start      # 前端开发服务器 (端口3000)
```

## 📦 生产部署

### 1. 构建前端
```bash
npm run build
```

### 2. 启动生产服务器
```bash
npm run server
```

## ⚠️ 部署注意事项

### 1. 数据库文件
- `products.db` 会自动创建
- 生产环境建议备份数据库文件

### 2. 文件上传目录
- `uploads/` 目录会自动创建
- 确保有写入权限

### 3. API密钥安全
- 生产环境务必设置环境变量 `GEMINI_API_KEY`
- 不要将API密钥提交到代码仓库

### 4. 端口配置
- 默认端口3001
- 可通过环境变量 `PORT` 修改

## 🔧 故障排除

### 常见问题
1. **依赖安装失败**：删除 `node_modules` 和 `package-lock.json`，重新安装
2. **数据库权限错误**：确保应用有当前目录写入权限
3. **文件上传失败**：检查 `uploads/` 目录权限
4. **API调用失败**：确认 `GEMINI_API_KEY` 配置正确

### 日志查看
```bash
# 查看后端日志
node server.js

# 前端开发日志
npm start
```

## 📝 版本历史
- v0.1.5: 接入大模型初步成功 - 完成核心AI解析功能
- v0.1.4: 大模型接入前-稳定版 - 基础CRUD功能完成 

# 云端部署指南

## 📋 部署前准备

### 系统架构
- **前端**: React应用 (端口3000 → 80/443)
- **MongoDB服务器**: Express + MongoDB (端口3001 → 80/443)  
- **AI分析服务器**: Express + Gemini AI (端口3002 → 8080)

## 🔧 需要修改的配置

### 1. 前端环境变量 (.env)
```bash
# 开发环境
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_AI_SERVER_URL=http://localhost:3002

# 生产环境
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_AI_SERVER_URL=https://ai.yourdomain.com
```

### 2. MongoDB服务器环境变量 (server/.env)
```bash
# 开发环境
PORT=3001
MONGODB_URI=mongodb://localhost:27017/quotation_system
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# 生产环境
PORT=80
MONGODB_URI=mongodb://username:password@cloud-db-host:27017/quotation_system
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
```

### 3. AI服务器环境变量 (根目录/.env)
```bash
# 开发环境
PORT=3002

# 生产环境
PORT=8080
```

## 🚀 部署步骤

### 方案一：单服务器部署
1. **前端**: 构建静态文件，用Nginx托管
2. **MongoDB服务器**: 运行在80端口，配置反向代理
3. **AI服务器**: 运行在8080端口，配置反向代理

### 方案二：分布式部署
1. **前端**: 部署到CDN (如Vercel, Netlify)
2. **MongoDB服务器**: 部署到云服务器 (如阿里云, AWS)
3. **AI服务器**: 独立部署到另一台服务器

## 📝 修改摘要

✅ **已经完成的优化**:
- 前端API调用已使用环境变量
- 后端CORS配置支持环境变量
- AI服务器URL已改为环境变量

❌ **不需要修改的部分**:
- 数据库模型和业务逻辑
- 组件结构和UI界面
- AI分析逻辑

## 🔍 部署检查清单

- [ ] 配置环境变量
- [ ] 修改数据库连接字符串
- [ ] 配置域名和SSL证书
- [ ] 测试跨域访问
- [ ] 检查文件上传路径
- [ ] 验证API接口可用性

## 💡 推荐部署方案

**阿里云/AWS部署**:
1. ECS实例运行后端服务
2. RDS/DocumentDB作为数据库
3. OSS/S3存储上传文件
4. CDN加速前端静态资源 