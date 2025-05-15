import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

const { Title } = Typography;

const Cost: React.FC = () => {
    return (
        <div style={{ padding: '20px' }}>
            <Title heading={2}>成本预估</Title>
            {/* 成本预估页面的具体内容 */}
        </div>
    );
};

export default Cost; 