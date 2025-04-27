import { Layout, Typography } from '@douyinfe/semi-ui';
import React from 'react';

const { Content } = Layout;

const QuotationHelper: React.FC = () => (
    <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography.Title heading={1}>Hello from Quotation Helper!</Typography.Title>
    </Content>
);

export default QuotationHelper; 