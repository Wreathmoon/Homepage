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