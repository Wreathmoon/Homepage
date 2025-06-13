# AI 服务配置指南

## ✅ 配置已修正

根据元景大模型官方文档，正确的配置应该是：

### 🔧 正确的配置方式

**元景大模型配置**：
- API端点：`https://maas-api.ai-yuanjing.com/openapi/compatible-mode/v1`
- 只需要API密钥（不需要单独的模型ID）
- 模型名称：`yuanjing-7b-chat`（通过`model`参数指定）

**测试结果**：
- ✅ API调用成功（状态码200）
- ✅ 认证通过
- ✅ 网络连接正常

### 📋 环境变量配置

创建或更新您的 `.env` 文件：

```bash
# 元景大模型配置（修正版）
YUANJING_API_KEY=sk-59454f95d79b4d5d9ad8d5d9d6237bc1
YUANJING_MODEL=yuanjing-7b-chat
YUANJING_API_ENDPOINT=https://maas-api.ai-yuanjing.com/openapi/compatible-mode/v1
```

### 🔍 常见问题已解决

1. **API端点错误** ❌ `https://maas.ai-yuanjing.com` → ✅ `https://maas-api.ai-yuanjing.com`
2. **配置混淆** ❌ 使用了错误的模型ID → ✅ 使用正确的模型名称
3. **参数错误** ❌ `modelId` → ✅ `model`

## 🚀 下一步操作

现在您的元景大模型API已经配置正确并可以连接。建议：

1. **启动服务器**：
   ```bash
   node server.js
   ```

2. **测试报价分析功能**：
   - 访问 `http://localhost:3002`
   - 上传报价文件
   - 测试AI分析功能

3. **监控日志**：
   - 查看控制台输出
   - 确认AI分析是否正常工作

## 📞 技术支持

### 元景大模型技术支持
- 官方网站: [https://ai-yuanjing.com](https://ai-yuanjing.com)
- 技术文档: 查看官方API文档
- 客服支持: 联系官方技术支持

### 项目技术支持
如果需要项目相关的技术支持，请检查：

1. **日志信息**: 查看控制台输出的详细错误信息
2. **网络连通性**: 确认能访问AI服务端点
3. **环境变量**: 确认所有必需的环境变量都已正确设置
4. **依赖包**: 确认所有npm包都已正确安装

## 🔧 下一步行动

### 立即行动项
1. [ ] 联系元景大模型技术支持，验证API凭据
2. [ ] 获取备用AI服务的API密钥（推荐Azure OpenAI）
3. [ ] 更新环境变量配置
4. [ ] 重新测试AI集成功能

### 长期优化
1. [ ] 设置监控告警，及时发现AI服务异常
2. [ ] 配置多个备用AI服务，提高系统可靠性
3. [ ] 优化AI调用的错误处理和重试机制 