import { IconBell, IconHelpCircle, IconMoon, IconSun } from '@douyinfe/semi-icons';
import { Avatar, Button, Layout, Nav } from '@douyinfe/semi-ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Header = () => {
    const [isDark, setIsDark] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

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

    const getActiveKey = () => {
        const path = location.pathname;
        if (path === '/home') return 'Home';
        if (path === '/portal') return 'Portal';
        if (path === '/tools') return 'Tools';
        if (path === '/contact') return 'Contact';
        return 'Home';
    };

    return (
        <Layout.Header style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
            <div>
                <Nav mode="horizontal" defaultSelectedKeys={[getActiveKey()]}>
                    <Nav.Header>
                        <div 
                            style={{ color: '#E91E63', cursor: 'pointer' }} 
                            onClick={() => navigate('/home')}
                        >
                            <img 
                                src="/24764324_183446961832_2.jpg" 
                                alt="联通Logo" 
                                style={{ 
                                    height: '36px', 
                                    width: 'auto',
                                    objectFit: 'contain'
                                }} 
                            />
                        </div>
                    </Nav.Header>

                    <Nav.Item
                        itemKey="Portal"
                        text="Portal"
                        onClick={() => navigate('/portal')}
                        style={{
                            color: getActiveKey() === 'Portal' ? 'var(--semi-color-text-0)' : 'var(--semi-color-text-1)',
                            fontWeight: getActiveKey() === 'Portal' ? '600' : 'normal',
                        }}
                    />
                    <Nav.Item
                        itemKey="Tools"
                        text="Tools"
                        onClick={() => navigate('/tools')}
                        style={{
                            color: getActiveKey() === 'Tools' ? 'var(--semi-color-text-0)' : 'var(--semi-color-text-1)',
                            fontWeight: getActiveKey() === 'Tools' ? '600' : 'normal',
                        }}
                    />
                    <Nav.Item
                        itemKey="Contact"
                        text="Contact"
                        onClick={() => navigate('/contact')}
                        style={{
                            color: getActiveKey() === 'Contact' ? 'var(--semi-color-text-0)' : 'var(--semi-color-text-1)',
                            fontWeight: getActiveKey() === 'Contact' ? '600' : 'normal',
                        }}
                    />

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