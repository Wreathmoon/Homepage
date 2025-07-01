import React, { useState, useEffect, useCallback } from 'react';
import { 
    Typography, 
    Button, 
    Table, 
    Modal,
    Toast,
    Space,
    Tag,
    Descriptions,
    Input,
    Card
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { IconUser, IconDelete, IconPlus, IconRefresh, IconCopy } from '@douyinfe/semi-icons';
import { 
    getAllUsers, 
    deleteUser, 
    generateRegistrationCode,
    getRegistrationCodes,
    type User,
    type RegistrationCode
} from '../services/auth';

const { Title, Text } = Typography;

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [registrationCodes, setRegistrationCodes] = useState<RegistrationCode[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [codeModalVisible, setCodeModalVisible] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [newCode, setNewCode] = useState<{ code: string; expiresAt: string } | null>(null);

    // 获取用户列表
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const userList = await getAllUsers();
            setUsers(userList);
        } catch (error) {
            console.error('获取用户列表失败:', error);
            Toast.error('获取用户列表失败');
        } finally {
            setLoading(false);
        }
    }, []);

    // 获取注册码列表
    const fetchRegistrationCodes = useCallback(async () => {
        try {
            const codes = await getRegistrationCodes();
            setRegistrationCodes(codes);
        } catch (error) {
            console.error('获取注册码列表失败:', error);
            Toast.error('获取注册码列表失败');
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchRegistrationCodes();
    }, [fetchUsers, fetchRegistrationCodes]);

    // 删除用户
    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            await deleteUser(userToDelete._id);
            Toast.success('用户删除成功');
            setDeleteModalVisible(false);
            setUserToDelete(null);
            fetchUsers();
        } catch (error) {
            console.error('删除用户失败:', error);
            Toast.error('删除用户失败');
        }
    };

    // 生成注册码
    const handleGenerateCode = async () => {
        try {
            const result = await generateRegistrationCode();
            setNewCode(result);
            setCodeModalVisible(true);
            fetchRegistrationCodes();
            Toast.success('注册码生成成功');
        } catch (error) {
            console.error('生成注册码失败:', error);
            Toast.error('生成注册码失败');
        }
    };

    // 复制注册码
    const handleCopyCode = (code: string) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                Toast.success('注册码已复制到剪贴板');
            }).catch(() => {
                fallbackCopyTextToClipboard(code);
            });
        } else {
            fallbackCopyTextToClipboard(code);
        }
    };

    // 回退复制方法
    const fallbackCopyTextToClipboard = (text: string) => {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed'; // 防止滚动跳动
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (successful) {
                Toast.success('注册码已复制到剪贴板');
            } else {
                Toast.error('复制失败，请手动复制');
            }
        } catch (err) {
            Toast.error('复制失败，请手动复制');
        }
    };

    const userColumns: ColumnProps<User>[] = [
        {
            title: '用户名',
            dataIndex: 'username',
            width: 150
        },
        {
            title: '显示名称',
            dataIndex: 'displayName',
            width: 150
        },
        {
            title: '角色',
            dataIndex: 'role',
            width: 100,
            render: (role: string) => (
                <Tag color={role === 'admin' ? 'red' : 'blue'} type="light">
                    {role === 'admin' ? '管理员' : '普通用户'}
                </Tag>
            )
        },
        {
            title: '创建者',
            dataIndex: 'createdBy',
            width: 120,
            render: (text: string) => text || '系统'
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (text: string) => new Date(text).toLocaleString()
        },
        {
            title: '操作',
            key: 'actions',
            width: 100,
            render: (_, record: User) => {
                const currentUser = localStorage.getItem('user_username');
                const isCurrentUser = record.username === currentUser;
                
                return (
                    <Button
                        icon={<IconDelete />}
                        type="danger"
                        theme="borderless"
                        size="small"
                        disabled={isCurrentUser}
                        onClick={() => {
                            setUserToDelete(record);
                            setDeleteModalVisible(true);
                        }}
                        title={isCurrentUser ? '不能删除自己的账号' : '删除用户'}
                    >
                        删除
                    </Button>
                );
            }
        }
    ];

    const codeColumns: ColumnProps<RegistrationCode>[] = [
        {
            title: '注册码',
            dataIndex: 'code',
            width: 120,
            render: (code: string) => (
                <Space>
                    <Text code>{code}</Text>
                    <Button
                        icon={<IconCopy />}
                        type="tertiary"
                        theme="borderless"
                        size="small"
                        onClick={() => handleCopyCode(code)}
                        title="复制注册码"
                    />
                </Space>
            )
        },
        {
            title: '状态',
            dataIndex: 'isUsed',
            width: 100,
            render: (isUsed: boolean) => (
                <Tag color={isUsed ? 'grey' : 'green'} type="light">
                    {isUsed ? '已使用' : '未使用'}
                </Tag>
            )
        },
        {
            title: '使用者',
            dataIndex: 'usedBy',
            width: 120,
            render: (text: string) => text || '-'
        },
        {
            title: '过期时间',
            dataIndex: 'expiresAt',
            width: 180,
            render: (text: string) => new Date(text).toLocaleString()
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (text: string) => new Date(text).toLocaleString()
        }
    ];

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title heading={3}>账号管理</Title>
                <Space>
                    <Button
                        icon={<IconRefresh />}
                        onClick={() => {
                            fetchUsers();
                            fetchRegistrationCodes();
                        }}
                    >
                        刷新
                    </Button>
                    <Button
                        icon={<IconPlus />}
                        type="primary"
                        onClick={handleGenerateCode}
                    >
                        生成注册码
                    </Button>
                </Space>
            </div>

            <Card title="用户列表" style={{ marginBottom: '20px' }}>
                <Table
                    columns={userColumns}
                    dataSource={users}
                    loading={loading}
                    pagination={false}
                    rowKey="_id"
                />
            </Card>

            <Card title="注册码管理">
                <Table
                    columns={codeColumns}
                    dataSource={registrationCodes}
                    pagination={false}
                    rowKey="_id"
                />
            </Card>

            {/* 删除用户确认弹窗 */}
            <Modal
                title="删除用户"
                visible={deleteModalVisible}
                onCancel={() => {
                    setDeleteModalVisible(false);
                    setUserToDelete(null);
                }}
                onOk={handleDeleteUser}
                okText="确认删除"
                cancelText="取消"
                type="warning"
            >
                <p>确定要删除用户 <strong>{userToDelete?.displayName}</strong> 吗？</p>
                <p style={{ color: 'var(--semi-color-warning)', fontSize: '14px' }}>
                    此操作不可撤销，该用户将无法再登录系统。
                </p>
            </Modal>

            {/* 新注册码弹窗 */}
            <Modal
                title="注册码生成成功"
                visible={codeModalVisible}
                onCancel={() => {
                    setCodeModalVisible(false);
                    setNewCode(null);
                }}
                footer={
                    <Space>
                        <Button onClick={() => newCode && handleCopyCode(newCode.code)} icon={<IconCopy />}>
                            复制注册码
                        </Button>
                        <Button 
                            type="primary" 
                            onClick={() => {
                                setCodeModalVisible(false);
                                setNewCode(null);
                            }}
                        >
                            确定
                        </Button>
                    </Space>
                }
            >
                {newCode && (
                    <div>
                        <p>请将以下注册码提供给需要注册的用户：</p>
                        <div style={{ 
                            background: 'var(--semi-color-fill-0)', 
                            padding: '16px', 
                            borderRadius: '8px',
                            textAlign: 'center',
                            margin: '16px 0'
                        }}>
                            <Text 
                                code 
                                style={{ 
                                    fontSize: '24px', 
                                    fontWeight: 'bold',
                                    color: 'var(--semi-color-primary)'
                                }}
                            >
                                {newCode.code}
                            </Text>
                        </div>
                        <p style={{ color: 'var(--semi-color-text-2)', fontSize: '14px' }}>
                            过期时间：{new Date(newCode.expiresAt).toLocaleString()}
                        </p>
                        <p style={{ color: 'var(--semi-color-warning)', fontSize: '14px' }}>
                            注意：注册码有效期为24小时，仅可使用一次。
                        </p>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default UserManagement; 