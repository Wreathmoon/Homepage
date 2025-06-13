# Homepage

A React-based tool to help with quotation management.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

# 智能报价助手系统

> 基于元景70B大模型的企业级报价管理系统 v1.0.0

## 🚀 功能特性

### 核心功能
- **🤖 AI报价分析**: 使用元景70B大模型智能分析报价文件
- **📄 多格式支持**: Excel (.xlsx/.xls)、PDF、Word (.docx/.doc) 文件解析
- **🔍 重复检测**: 自动检测重复文件和产品信息
- **📊 数据管理**: 完整的供应商和报价记录管理
- **💱 多币种支持**: 32种主流货币支持
- **📧 询价邮件**: 自动生成专业英文询价邮件

### 技术栈
- **前端**: React 18 + TypeScript + Semi Design UI
- **后端**: Node.js + Express + MongoDB
- **AI**: 元景70B大模型 (yuanjing-70b-chat)
- **文件处理**: multer + xlsx + pdf-parse + mammoth

## 🛠️ 快速开始

### 环境要求
- Node.js >= 16.0.0
- MongoDB (本地或云端)
- 元景大模型API密钥

### 安装部署

1. **克隆项目**
```bash
git clone <repository-url>
cd quotation-helper
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
# 创建.env文件
MONGODB_URI=mongodb://localhost:27017/quotation_db
YUANJING_API_KEY=your_yuanjing_api_key
YUANJING_MODEL=yuanjing-70b-chat
YUANJING_API_ENDPOINT=https://maas-api.ai-yuanjing.com/openapi/compatible-mode/v1
PORT=3002
NODE_ENV=production
```

4. **构建和启动**
```bash
npm run build
npm run server
```

5. **访问应用**
打开浏览器访问: http://localhost:3002

## 🌐 生产环境部署

### Vercel部署
1. 连接GitHub仓库到Vercel
2. 配置环境变量
3. 部署完成

### 其他云平台
- **Heroku**: 支持自动部署
- **阿里云/腾讯云**: 支持容器化部署
- **Docker**: 可打包为Docker镜像

## 📖 API文档

### 核心接口
- `POST /api/quotations/upload` - 文件上传
- `POST /api/quotations/analyze` - AI分析
- `POST /api/quotations/confirm-save` - 确认保存
- `GET /api/quotations/list` - 查询历史
- `GET /api/quotations/download/:id` - 下载原文件

## 🔧 配置说明

### 元景大模型配置
- 支持70B和7B模型
- 默认使用70B模型获得更好的分析质量
- 可通过环境变量调整模型参数

### 数据库配置
- 默认使用MongoDB
- 支持本地和云端MongoDB
- 自动创建索引和集合

## 📝 更新日志

### v1.0.0 (2024-12-13)
- ✅ 集成元景70B大模型
- ✅ 优化AI分析精度和速度
- ✅ 简化部署配置
- ✅ 清理冗余代码
- ✅ 生产环境优化

### v0.1.6
- ✅ 完整功能实现
- ✅ 前后端集成
- ✅ 基础AI集成

## 🤝 技术支持

如有问题，请查看以下资源：
1. 检查环境变量配置
2. 确认MongoDB连接
3. 验证元景API密钥
4. 查看控制台日志

## 📄 开源协议

本项目采用 MIT 开源协议
