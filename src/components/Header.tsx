import { IconMoon, IconSun } from '@douyinfe/semi-icons';
import { Button, Nav } from '@douyinfe/semi-ui';
import React from 'react';

const Header: React.FC = () => {
    const switchMode = () => {
        const body = document.body;
        if (body.hasAttribute('theme-mode')) {
            body.removeAttribute('theme-mode');
        } else {
            body.setAttribute('theme-mode', 'dark');
        }
    };

    return (
        <Nav mode="horizontal">
            <Nav.Header>
                <h3 style={{ margin: '12px 20px', color: 'var(--semi-color-text-0)' }}>
                    Wreathmoon
                </h3>
            </Nav.Header>
            <Nav.Footer>
                <Button
                    theme="borderless"
                    icon={document.body.hasAttribute('theme-mode') ? <IconSun /> : <IconMoon />}
                    style={{ color: 'var(--semi-color-text-2)', marginRight: '12px' }}
                    onClick={switchMode}
                />
            </Nav.Footer>
        </Nav>
    );
};

export default Header; 