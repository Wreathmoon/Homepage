import { IconMoon, IconSun, IconUser, IconExit, IconUserGroup, IconLock } from '@douyinfe/semi-icons';
import { Button, Layout, Dropdown, Avatar, Space, Typography } from '@douyinfe/semi-ui';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ChangePassword from './ChangePassword';

const { Text } = Typography;

interface HeaderProps {
    onUserManagement?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onUserManagement }) => {
    const [isDark, setIsDark] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const { currentUser, logout, isAdmin } = useAuth();

    // dark mode switch function
    const switchMode = () => {
        const body = document.body;
        const html = document.documentElement;
        const enableDark = !body.hasAttribute('theme-mode');
        if (enableDark) {
            body.setAttribute('theme-mode', 'dark');
            html.setAttribute('theme-mode', 'dark');
        } else {
            body.removeAttribute('theme-mode');
            html.removeAttribute('theme-mode');
        }
        setIsDark(enableDark);
    };

    // 用户菜单选项
    const userMenuItems = [
        ...(isAdmin ? [{
            node: 'item' as const,
            name: '账号管理',
            icon: <IconUserGroup />,
            onClick: onUserManagement
        }] : []),
        {
            node: 'item' as const,
            name: '修改密码',
            icon: <IconLock />,
            onClick: () => setShowChangePassword(true)
        },
        {
            node: 'item' as const,
            name: '退出登录',
            icon: <IconExit />,
            onClick: logout
        }
    ];

    return (
        <Layout.Header style={{ 
            backgroundColor: 'var(--semi-color-bg-1)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            height: '60px',
            borderBottom: '1px solid var(--semi-color-border)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
            <div 
                style={{ 
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                <img 
                    src="/logo矢量.png" 
                    alt="联通Logo" 
                    style={{ 
                        height: '36px', 
                        width: 'auto',
                        objectFit: 'contain'
                    }} 
                />
                <span style={{
                    marginLeft: '12px',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: 'var(--semi-color-text-0)'
                }}>
                    询价小程序
                </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <Space>
                    <Button
                        theme="borderless"
                        icon={isDark ? <IconSun size="large" /> : <IconMoon size="large" />}
                        onClick={switchMode}
                        style={{
                            color: 'var(--semi-color-text-2)',
                        }}
                    />
                    
                    <Dropdown 
                        menu={userMenuItems}
                        trigger="click"
                        position="bottomRight"
                    >
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--semi-color-fill-0)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        >
                            <Avatar 
                                size="small" 
                                style={{ 
                                    backgroundColor: 'var(--semi-color-primary)',
                                    marginRight: '8px'
                                }}
                            >
                                <IconUser />
                            </Avatar>
                            <Text style={{ 
                                color: 'var(--semi-color-text-0)',
                                fontSize: '14px'
                            }}>
                                {currentUser || '用户'}
                            </Text>
                        </div>
                    </Dropdown>
                </Space>
            </div>
            
            <ChangePassword
                visible={showChangePassword}
                onCancel={() => setShowChangePassword(false)}
                onSuccess={() => {
                    setShowChangePassword(false);
                    // 密码修改成功后可以添加额外的逻辑，比如重新登录
                }}
            />
        </Layout.Header>
    );
};

export default Header; 