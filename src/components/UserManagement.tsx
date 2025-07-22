import React, { useState, useEffect, useCallback } from 'react';
import { 
    Typography, 
    Button, 
    Table, 
    Modal,
    Toast,
    Space,
    Tag,
    Card,
    Switch,
    
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { IconDelete, IconPlus, IconCopy, IconDownload, IconAlertTriangle, IconTick, IconSend, IconKey } from '@douyinfe/semi-icons';
import * as XLSX from 'xlsx';
import { 
    getAllUsers, 
    deleteUser, 
    generateRegistrationCode,
    getRegistrationCodes,
    deleteRegistrationCode,
    type User,
    type RegistrationCode
} from '../services/auth';
import { resetUserPassword } from '../services/auth';
import { API_CONFIG } from '../utils/config';
import { scheduleMaintenance, stopMaintenance } from '../services/maintenance';

const { Title, Text } = Typography;

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [registrationCodes, setRegistrationCodes] = useState<RegistrationCode[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [codeModalVisible, setCodeModalVisible] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [newCode, setNewCode] = useState<{ code: string; expiresAt: string } | null>(null);
    const [deleteCodeModalVisible, setDeleteCodeModalVisible] = useState(false);
    const [codeToDelete, setCodeToDelete] = useState<RegistrationCode | null>(null);
    // 公告
    const [announceModalVisible, setAnnounceModalVisible] = useState(false);
    const [announceText, setAnnounceText] = useState('');

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

    // 删除注册码
    const handleDeleteCode = async () => {
        if (!codeToDelete) return;
        try {
            await deleteRegistrationCode(codeToDelete._id);
            Toast.success('注册码删除成功');
            setDeleteCodeModalVisible(false);
            setCodeToDelete(null);
            fetchRegistrationCodes();
        } catch (error) {
            console.error('删除注册码失败:', error);
            Toast.error('删除注册码失败');
        }
    };

    // 导出用户名单
    const handleExportUsers = () => {
        const data = users.map(u => ({
            用户名: u.username,
            显示名称: u.displayName,
            角色: u.role === 'admin' ? '管理员' : '普通用户',
            创建者: u.createdBy || '系统',
            创建时间: new Date(u.createdAt).toLocaleString()
        }));
        if (data.length === 0) {
            Toast.info('暂无数据可导出');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Users');
        XLSX.writeFile(wb, `users_${Date.now()}.xlsx`);
    };

    // 导出注册码列表
    const handleExportCodes = () => {
        const data = registrationCodes.map(c => ({
            注册码: c.code,
            状态: c.isUsed ? '已使用' : '未使用',
            使用者: c.usedBy || '',
            过期时间: new Date(c.expiresAt).toLocaleString(),
            创建时间: new Date(c.createdAt).toLocaleString()
        }));
        if (data.length === 0) {
            Toast.info('暂无数据可导出');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Codes');
        XLSX.writeFile(wb, `codes_${Date.now()}.xlsx`);
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
            title: '供应商编辑权限',
            dataIndex: 'vendorEditable',
            width: 160,
            render: (ve: any, record: any) => {
                const userRole = localStorage.getItem('user_role');
                if (userRole !== 'admin') return ve?.enabled ? '已授权' : '未授权';
                return (
                    <Switch
                        checked={ve?.enabled && new Date(ve.expiresAt) > new Date()}
                        size="small"
                        onChange={async (checked) => {
                            try {
                                const res = await fetch(`${API_CONFIG.API_URL}/api/users/${record._id}/vendor-edit`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'x-user': encodeURIComponent(localStorage.getItem('user_username') || ''),
                                        'x-user-role': 'admin'
                                    },
                                    body: JSON.stringify({ enable: checked, hours: 5 })
                                });
                                const json = await res.json();
                                if (json.success) {
                                    Toast.success('操作成功');
                                    fetchUsers();
                                } else {
                                    Toast.error(json.message || '操作失败');
                                }
                            } catch (err) {
                                Toast.error('操作失败');
                            }
                        }}
                    />
                );
            }
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
        },
        {
            title: '重置密码',
            key: 'reset',
            width: 100,
            render: (_: any, record: User) => {
                const currentUser = localStorage.getItem('user_username');
                const isCurrentUser = record.username === currentUser;
                return (
                    <Button
                        icon={<IconKey />}
                        type="secondary"
                        theme="borderless"
                        size="small"
                        disabled={isCurrentUser}
                        onClick={async () => {
                            Modal.confirm({
                                title: '确认重置密码',
                                content: `确定将用户 ${record.username} 的密码重置为默认值？`,
                                onOk: async () => {
                                    try {
                                        await resetUserPassword(record._id);
                                        Toast.success('密码已重置为 password123!');
                                    } catch (err) {
                                        Toast.error('重置失败');
                                    }
                                }
                            });
                        }}
                        title={isCurrentUser ? '不能重置自己的密码' : '重置密码'}
                    >
                        重置
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
        },
        {
            title: '操作',
            key: 'codeActions',
            width: 100,
            render: (_, record: RegistrationCode) => (
                <Button
                    icon={<IconDelete />}
                    type="danger"
                    theme="borderless"
                    size="small"
                    onClick={() => {
                        setCodeToDelete(record);
                        setDeleteCodeModalVisible(true);
                    }}
                >
                    删除
                </Button>
            )
        }
    ];

    const handleSchedule = async () => {
        try {
            await scheduleMaintenance(180, '服务器将在三分钟后重启并部署更新，请停止供应商录入，正在录入的请尽快保存');
            Toast.success('维护通知已发送');
        } catch (e) {
            Toast.error('操作失败');
        }
    };

    const handleStopMaintain = async () => {
        try {
            await stopMaintenance();
            Toast.success('已退出维护模式');
        } catch (e) {
            Toast.error('操作失败');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title heading={3}>账号管理</Title>
                <Space style={{ marginBottom: 16 }}>
                    <Button icon={<IconPlus />} onClick={handleGenerateCode}>生成注册码</Button>
                    <Button icon={<IconDownload />} onClick={handleExportUsers}>导出用户</Button>
                    <Button icon={<IconDownload />} onClick={handleExportCodes}>导出注册码</Button>
                    <Button icon={<IconSend />} theme="solid" onClick={() => setAnnounceModalVisible(true)}>发布公告</Button>
                    <Button icon={<IconAlertTriangle />} theme="solid" type="warning" onClick={handleSchedule}>发送维护预告</Button>
                    <Button icon={<IconTick />} theme="solid" onClick={handleStopMaintain}>维护结束</Button>
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

            {/* 删除注册码确认弹窗 */}
            <Modal
                title="删除注册码"
                visible={deleteCodeModalVisible}
                onCancel={() => {
                    setDeleteCodeModalVisible(false);
                    setCodeToDelete(null);
                }}
                onOk={handleDeleteCode}
                okText="确认删除"
                cancelText="取消"
                type="warning"
            >
                <p>确定要删除注册码 <strong>{codeToDelete?.code}</strong> 吗？</p>
            </Modal>

            {/* 发布公告弹窗 */}
            <Modal
                title="发布公告"
                visible={announceModalVisible}
                onCancel={() => setAnnounceModalVisible(false)}
                onOk={async () => {
                    if (!announceText.trim()) { Toast.warning('公告内容不能为空'); return; }
                    try { await (await import('../services/announcement')).postAnnouncement(announceText.trim());
                        Toast.success('公告已发布');
                        setAnnounceModalVisible(false);
                        setAnnounceText('');
                    } catch { Toast.error('发布失败'); }
                }}
                okText="发布"
                cancelText="取消"
            >
                <textarea
                    style={{ width: '100%', height: 120 }}
                    value={announceText}
                    onChange={e => setAnnounceText(e.target.value)}
                    placeholder="请输入公告内容"
                />
            </Modal>
        </div>
    );
};

export default UserManagement; 