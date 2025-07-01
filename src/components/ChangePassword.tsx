import React, { useState } from 'react';
import { Modal, Form, Button, Typography, Toast, Space } from '@douyinfe/semi-ui';
import { IconLock, IconEyeOpened, IconEyeClosed } from '@douyinfe/semi-icons';
import { changePassword } from '../services/auth';

const { Text } = Typography;

interface ChangePasswordProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess?: () => void;
}

interface PasswordFormData {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ visible, onCancel, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (values: PasswordFormData) => {
        if (values.newPassword !== values.confirmPassword) {
            Toast.error('两次输入的新密码不一致');
            return;
        }

        if (values.oldPassword === values.newPassword) {
            Toast.error('新密码不能与旧密码相同');
            return;
        }

        setLoading(true);
        try {
            await changePassword(values.oldPassword, values.newPassword);
            Toast.success('密码修改成功！');
            onCancel(); // 关闭弹窗
            onSuccess?.(); // 执行成功回调
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message || '密码修改失败';
            Toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // 密码强度检查
    const getPasswordStrength = (password: string) => {
        if (!password) return { level: 0, text: '', color: '' };
        
        let score = 0;
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        score = Object.values(checks).filter(Boolean).length;
        
        if (score < 2) return { level: 1, text: '弱', color: 'var(--semi-color-danger)' };
        if (score < 4) return { level: 2, text: '中', color: 'var(--semi-color-warning)' };
        return { level: 3, text: '强', color: 'var(--semi-color-success)' };
    };

    const PasswordStrengthIndicator = ({ password }: { password: string }) => {
        const strength = getPasswordStrength(password);
        if (!password) return null;
        
        return (
            <div style={{ marginTop: '8px' }}>
                <Text type="secondary" size="small">
                    密码强度：
                    <span style={{ color: strength.color, fontWeight: 'bold' }}>
                        {strength.text}
                    </span>
                </Text>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    {[1, 2, 3].map(level => (
                        <div
                            key={level}
                            style={{
                                height: '4px',
                                flex: 1,
                                backgroundColor: level <= strength.level ? strength.color : 'var(--semi-color-fill-1)',
                                borderRadius: '2px'
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Modal
            title="修改密码"
            visible={visible}
            onCancel={onCancel}
            footer={null}
            width={500}
            maskClosable={false}
        >
            <Form<PasswordFormData>
                onSubmit={handleSubmit}
                labelPosition="left"
                labelWidth="80px"
                style={{ marginTop: '20px' }}
            >
                <Form.Input
                    field="oldPassword"
                    label="旧密码"
                    type={showOldPassword ? 'text' : 'password'}
                    placeholder="请输入当前密码"
                    prefix={<IconLock />}
                    suffix={
                        <Button
                            icon={showOldPassword ? <IconEyeClosed /> : <IconEyeOpened />}
                            type="tertiary"
                            theme="borderless"
                            size="small"
                            onClick={() => setShowOldPassword(!showOldPassword)}
                        />
                    }
                    rules={[
                        { required: true, message: '请输入当前密码' }
                    ]}
                    style={{ marginBottom: '20px' }}
                />

                <Form.Input
                    field="newPassword"
                    label="新密码"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="请输入新密码"
                    prefix={<IconLock />}
                    suffix={
                        <Button
                            icon={showNewPassword ? <IconEyeClosed /> : <IconEyeOpened />}
                            type="tertiary"
                            theme="borderless"
                            size="small"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                        />
                    }
                    rules={[
                        { required: true, message: '请输入新密码' },
                        { min: 6, message: '密码至少需要6个字符' }
                    ]}
                    style={{ marginBottom: '8px' }}
                />

                <Form.Input
                    field="confirmPassword"
                    label="确认密码"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="请再次输入新密码"
                    prefix={<IconLock />}
                    suffix={
                        <Button
                            icon={showConfirmPassword ? <IconEyeClosed /> : <IconEyeOpened />}
                            type="tertiary"
                            theme="borderless"
                            size="small"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        />
                    }
                    rules={[
                        { required: true, message: '请确认新密码' }
                    ]}
                    style={{ marginBottom: '20px' }}
                />

                <div style={{ 
                    padding: '16px', 
                    backgroundColor: 'var(--semi-color-fill-0)', 
                    borderRadius: '8px',
                    marginBottom: '24px'
                }}>
                    <Text type="secondary" size="small">
                        <strong>密码要求：</strong>
                    </Text>
                    <div style={{ marginTop: '8px' }}>
                        <Text type="secondary" size="small">
                            • 至少6个字符<br/>
                            • 建议包含大小写字母<br/>
                            • 建议包含数字或特殊字符<br/>
                            • 不能与旧密码相同
                        </Text>
                    </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <Space spacing={20}>
                        <Button onClick={onCancel} disabled={loading}>
                            取消
                        </Button>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            loading={loading}
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none'
                            }}
                        >
                            {loading ? '修改中...' : '确认修改'}
                        </Button>
                    </Space>
                </div>
            </Form>
        </Modal>
    );
};

export default ChangePassword; 