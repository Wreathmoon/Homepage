const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// 测试AI服务
router.post('/test', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: '请提供提示词' });
    }

    const response = await aiService.generateResponse(prompt);
    res.json({ response });
  } catch (error) {
    console.error('AI测试错误:', error);
    res.status(500).json({ error: 'AI服务调用失败', details: error.message });
  }
});

// 分析报价单
router.post('/analyze', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: '请提供报价单内容' });
    }

    const analysis = await aiService.analyzeQuotation(content);
    res.json(analysis);
  } catch (error) {
    console.error('报价单分析错误:', error);
    res.status(500).json({ error: '报价单分析失败', details: error.message });
  }
});

module.exports = router; 