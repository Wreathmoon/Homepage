require('dotenv').config();
const axios = require('axios');

// 元景大模型配置 - 70B强化版
const YUANJING_CONFIG = {
    apiKey: 'sk-59454f95d79b4d5d9ad8d5d9d6237bc1',
    model: 'yuanjing-70b-chat', // 使用更强大的70B模型
    baseUrl: 'https://maas-api.ai-yuanjing.com/openapi/compatible-mode/v1'
};

async function testYuanJing70B() {
    console.log('🚀 开始测试元景70B大模型...');
    console.log('📋 配置信息:');
    console.log('  - API密钥:', YUANJING_CONFIG.apiKey.substring(0, 10) + '...');
    console.log('  - 模型名称:', YUANJING_CONFIG.model);
    console.log('  - API端点:', YUANJING_CONFIG.baseUrl);
    
    try {
        console.log('\n🔄 发送测试请求...');
        
        const response = await axios.post(
            `${YUANJING_CONFIG.baseUrl}/chat/completions`,
            {
                model: YUANJING_CONFIG.model,
                messages: [
                    {
                        role: "user",
                        content: "你好！请简单介绍一下你自己，并回答以下问题：1. 3+5等于多少？2. 请用中文解释什么是人工智能？"
                    }
                ],
                temperature: 0.7,
                max_tokens: 500, // 增加token限制，充分发挥70B模型的能力
                top_p: 0.9,
                stream: false
            },
            {
                headers: {
                    'Authorization': `Bearer ${YUANJING_CONFIG.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 60000 // 增加超时时间，70B模型可能需要更多时间
            }
        );

        console.log('\n📊 响应状态:', response.status);
        
        if (response.status === 200) {
            console.log('✅ 元景70B模型调用成功！');
            console.log('📋 响应数据:', JSON.stringify(response.data, null, 2));
            
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const aiResponse = response.data.choices[0].message.content;
                console.log('\n🤖 AI回复:');
                console.log('════════════════════════════════════════');
                console.log(aiResponse);
                console.log('════════════════════════════════════════');
                
                console.log('\n📊 Token使用情况:');
                console.log(`  - 输入Token: ${response.data.usage.prompt_tokens}`);
                console.log(`  - 输出Token: ${response.data.usage.completion_tokens}`);
                console.log(`  - 总Token: ${response.data.usage.total_tokens}`);
                
                console.log('\n🎉 元景70B大模型测试成功！');
                console.log('💪 模型性能强劲，可以用于复杂的报价分析任务！');
                return true;
            } else {
                console.log('⚠️ 响应格式异常');
                return false;
            }
        } else {
            console.log('❌ API调用失败');
            console.log('📋 错误数据:', JSON.stringify(response.data, null, 2));
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ 请求失败:', error.message);
        
        if (error.response) {
            console.log('📊 错误状态:', error.response.status);
            console.log('📋 错误数据:', JSON.stringify(error.response.data, null, 2));
        }
        
        return false;
    }
}

// 运行测试
testYuanJing70B().then(success => {
    if (success) {
        console.log('\n🎯 元景70B模型配置完成，准备投入使用！');
        console.log('🏢 现在可以启动服务器开始处理复杂的报价分析任务');
        process.exit(0);
    } else {
        console.log('\n🚫 70B模型测试失败');
        console.log('💡 可能的原因:');
        console.log('1. 账户权限不足，无法使用70B模型');
        console.log('2. 账户余额不足');
        console.log('3. 模型名称需要调整');
        process.exit(1);
    }
}).catch(err => {
    console.error('\n💥 测试过程中发生错误:', err);
    process.exit(1);
}); 