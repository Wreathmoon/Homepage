const axios = require('axios');

// 测试用，直接写死，确保不会undefined
const API_KEY = 'sk-59454f95d79b4d5d9ad8d5d9d6237bc1';
const MODEL_ID = 'c7eef62169294cbbbf48898d9b8080ce';
const API_URL = 'https://maas-api.ai-yuanjing.com/openapi/compatible-mode/v1/chat/completions';

class AIService {
  async generateResponse(prompt) {
    try {
      const response = await axios.post(
        API_URL,
        {
          model: MODEL_ID,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // 元景返回格式和OpenAI兼容，但建议先打印完整响应
      console.log('元景AI原始响应:', response.data);

      // 兼容OpenAI格式
      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        return response.data.choices[0].message.content;
      }
      // 兜底返回
      return JSON.stringify(response.data);
    } catch (error) {
      console.error('AI API调用错误:', error.response?.data || error.message);
      if (error.response) {
        console.error('错误状态码:', error.response.status);
        console.error('错误详情:', error.response.data);
      }
      throw new Error('AI服务调用失败');
    }
  }

  async analyzeQuotation(content) {
    const prompt = `请分析以下报价单内容，提取关键信息：
      ${content}
      请以JSON格式返回以下信息：
      - 产品名称
      - 单价
      - 数量
      - 总价
      - 供应商信息
      - 日期`;

    const response = await this.generateResponse(prompt);
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('解析AI响应失败:', error);
      throw new Error('AI响应格式错误');
    }
  }

  async getRecommendations(history) {
    const prompt = `基于以下历史报价数据，请推荐可能的产品组合：
      ${JSON.stringify(history)}
      请考虑：
      1. 价格趋势
      2. 季节性因素
      3. 市场供需关系`;

    const response = await this.generateResponse(prompt);
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('解析AI响应失败:', error);
      throw new Error('AI响应格式错误');
    }
  }
}

module.exports = new AIService(); 