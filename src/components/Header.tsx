import { IconMoon, IconSun } from '@douyinfe/semi-icons';
import { Button, Layout } from '@douyinfe/semi-ui';
import { useState } from 'react';

const Header = () => {
    const [isDark, setIsDark] = useState(false);

    // dark mode switch function
    const switchMode = () => {
        const body = document.body;
        if (body.hasAttribute('theme-mode')) {
            body.removeAttribute('theme-mode');
            setIsDark(false);
        } else {
            body.setAttribute('theme-mode', 'dark');
            setIsDark(true);
        }
    };

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
                <Button
                    theme="borderless"
                    icon={isDark ? <IconSun size="large" /> : <IconMoon size="large" />}
                    onClick={switchMode}
                    style={{
                        color: 'var(--semi-color-text-2)',
                    }}
                />
            </div>
        </Layout.Header>
    );
};

export default Header; 