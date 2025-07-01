import React, { useState } from 'react';
import { Card, Form, Button, Typography, Toast, Space } from '@douyinfe/semi-ui';
import { IconUser, IconLock, IconEyeOpened, IconEyeClosed } from '@douyinfe/semi-icons';
import { AUTH_CONFIG } from '../config/auth';

const { Title, Text } = Typography;

interface LoginProps {
    onLogin: (username: string, password: string) => Promise<boolean>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isRegisterMode, setIsRegisterMode] = useState(false);

    const handleSubmit = async (values: { username: string; password: string }) => {
        setLoading(true);
        
        try {
            const success = await onLogin(values.username, values.password);
            
            if (!success) {
                Toast.error('用户名或密码错误，请重试');
            }
        } catch (error) {
            Toast.error('登录失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (values: { username: string; password: string; displayName: string; registrationCode: string }) => {
        setLoading(true);
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(values)
            });

            const result = await response.json();
            
            if (result.success) {
                Toast.success('注册成功！请使用新账号登录');
                setIsRegisterMode(false);
            } else {
                Toast.error(result.message || '注册失败，请重试');
            }
        } catch (error) {
            Toast.error('注册失败，请重试');
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
                        {isRegisterMode ? '请填写注册信息' : '请输入您的登录凭据'}
                    </Text>
                </div>

                <Form onSubmit={isRegisterMode ? handleRegister : handleSubmit} style={{ width: '100%' }}>
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
                    
                    {isRegisterMode && (
                        <Form.Input
                            field="displayName"
                            label="显示名称"
                            placeholder="请输入显示名称"
                            prefix={<IconUser />}
                            size="large"
                            style={{ marginBottom: '20px' }}
                            rules={[
                                { required: true, message: '请输入显示名称' }
                            ]}
                        />
                    )}
                    
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
                        style={{ marginBottom: isRegisterMode ? '20px' : '32px' }}
                        rules={[
                            { required: true, message: '请输入密码' },
                            { min: AUTH_CONFIG.passwordMinLength, message: `密码至少${AUTH_CONFIG.passwordMinLength}个字符` }
                        ]}
                    />

                    {isRegisterMode && (
                        <Form.Input
                            field="registrationCode"
                            label="注册码"
                            placeholder="请输入管理员提供的注册码"
                            prefix={<IconLock />}
                            size="large"
                            style={{ marginBottom: '32px' }}
                            rules={[
                                { required: true, message: '请输入注册码' }
                            ]}
                        />
                    )}

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
                            fontSize: '16px',
                            marginBottom: '16px'
                        }}
                    >
                        {loading ? (isRegisterMode ? '注册中...' : '登录中...') : (isRegisterMode ? '注册' : '登录')}
                    </Button>

                    <div style={{ textAlign: 'center' }}>
                        <Button
                            type="tertiary"
                            theme="borderless"
                            onClick={() => setIsRegisterMode(!isRegisterMode)}
                            style={{ color: '#667eea' }}
                        >
                            {isRegisterMode ? '已有账号？返回登录' : '还没有账号？点击注册'}
                        </Button>
                    </div>
                </Form>


            </Card>
        </div>
    );
};

export default Login; 