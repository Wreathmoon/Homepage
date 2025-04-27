import { Layout, Typography } from '@douyinfe/semi-ui';
import React from 'react';

const { Content } = Layout;

const Home: React.FC = () => (
    <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography.Title heading={1}>Welcome to Wreathmoon</Typography.Title>
    </Content>
);

export default Home; 