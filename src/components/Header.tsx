import { IconApps, IconBell, IconHelpCircle, IconMoon, IconSun } from '@douyinfe/semi-icons';
import { Avatar, Button, Layout, Nav } from '@douyinfe/semi-ui';
import { useState } from 'react';

const Header = () => {
    const [isDark, setIsDark] = useState(false);

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
        <Layout.Header style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
            <div>
                <Nav mode="horizontal" defaultSelectedKeys={['Home']}>

                    <Nav.Header>
                        <div style={{ color: '#E91E63' }} >
                            <IconApps style={{ height: '36px', fontSize: 36 }} />
                        </div>
                    </Nav.Header>

                    <span
                        style={{
                            color: 'var(--semi-color-text-1)',
                        }}
                    >
                        <span
                            style={{
                                marginRight: '24px',
                                color: 'var(--semi-color-text-0)',
                                fontWeight: '600',
                            }}
                        >
                            Portal
                        </span>
                        <span style={{ marginRight: '24px' }}>Tools</span>
                        <span>Contact</span>
                    </span>

                    <Nav.Footer>
                        <Button
                            theme="borderless"
                            icon={isDark ? <IconSun size="large" /> : <IconMoon size="large" />}
                            onClick={switchMode}
                            style={{
                                color: 'var(--semi-color-text-2)',
                                marginRight: '12px',
                            }}
                        />
                        <Button
                            theme="borderless"
                            icon={<IconBell size="large" />}
                            style={{
                                color: 'var(--semi-color-text-2)',
                                marginRight: '12px',
                            }}
                        />
                        <Button
                            theme="borderless"
                            icon={<IconHelpCircle size="large" />}
                            style={{
                                color: 'var(--semi-color-text-2)',
                                marginRight: '12px',
                            }}
                        />
                        <Avatar color="pink" size="small">
                            WM
                        </Avatar>
                    </Nav.Footer>
                </Nav>
            </div>
        </Layout.Header>
    );
};

export default Header; 