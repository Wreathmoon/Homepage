import { Layout, Typography } from '@douyinfe/semi-ui';
import React from 'react';

const { Content } = Layout;

const Tools: React.FC = () => (
    <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography.Title heading={1}>Tools</Typography.Title>
    </Content>
);

export default Tools; 