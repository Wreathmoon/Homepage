import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

const { Title } = Typography;

const Vendor: React.FC = () => {
    return (
        <div style={{ padding: '20px' }}>
            <Title heading={2}>供应商查询</Title>
            {/* 供应商查询页面的具体内容 */}
        </div>
    );
};

export default Vendor; 