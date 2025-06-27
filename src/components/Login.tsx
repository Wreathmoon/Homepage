import React, { useState } from 'react';
import { Card, Form, Button, Typography, Toast, Space } from '@douyinfe/semi-ui';
import { IconUser, IconLock, IconEyeOpened, IconEyeClosed } from '@douyinfe/semi-icons';
import { AUTH_CONFIG } from '../config/auth';

const { Title, Text } = Typography;

interface LoginProps {
    onLogin: (username: string, password: string) => boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (values: { username: string; password: string }) => {
        setLoading(true);
        
        try {
            // 模拟登录延迟
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const success = onLogin(values.username, values.password);
            
            if (!success) {
                Toast.error('用户名或密码错误，请重试');
            }
        } catch (error) {
            Toast.error('登录失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <Card 
                style={{ 
                    width: '100%', 
                    maxWidth: '400px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                }}
                bodyStyle={{ padding: '40px' }}
            >
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <Title heading={2} style={{ color: '#1C1F23', marginBottom: '8px' }}>
                        智能报价助手
                    </Title>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                        请输入您的登录凭据
                    </Text>
                </div>

                <Form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <Form.Input
                        field="username"
                        label="用户名"
                        placeholder="请输入用户名"
                        prefix={<IconUser />}
                        size="large"
                        style={{ marginBottom: '20px' }}
                        rules={[
                            { required: true, message: '请输入用户名' },
                            { min: AUTH_CONFIG.usernameMinLength, message: `用户名至少${AUTH_CONFIG.usernameMinLength}个字符` }
                        ]}
                    />
                    
                    <Form.Input
                        field="password"
                        label="密码"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码"
                        prefix={<IconLock />}
                        suffix={
                            <Button
                                icon={showPassword ? <IconEyeClosed /> : <IconEyeOpened />}
                                type="tertiary"
                                theme="borderless"
                                size="small"
                                onClick={() => setShowPassword(!showPassword)}
                            />
                        }
                        size="large"
                        style={{ marginBottom: '32px' }}
                        rules={[
                            { required: true, message: '请输入密码' },
                            { min: AUTH_CONFIG.passwordMinLength, message: `密码至少${AUTH_CONFIG.passwordMinLength}个字符` }
                        ]}
                    />

                    <Button
                        htmlType="submit"
                        type="primary"
                        size="large"
                        loading={loading}
                        block
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            height: '48px',
                            fontSize: '16px'
                        }}
                    >
                        {loading ? '登录中...' : '登录'}
                    </Button>
                </Form>

                <div style={{ 
                    marginTop: '24px', 
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#8a8a8a'
                }}>
                    <Space>
                        <Text type="tertiary">默认账号：admin</Text>
                        <Text type="tertiary">密码：123456</Text>
                    </Space>
                </div>
            </Card>
        </div>
    );
};

export default Login; 