import React, { useState } from 'react';
import { IconSearch, IconMailStroked1, IconCart } from '@douyinfe/semi-icons';
import { Layout, Nav } from '@douyinfe/semi-ui';
import Header from '../components/Header';
import Quotation from '../components/Tools/Quotationhelper/Quotation';
import Vendor from '../components/Tools/Quotationhelper/Vendor';
import Cost from '../components/Tools/Quotationhelper/Cost';

const { Footer, Sider, Content } = Layout;

const QuotationHelper = () => {
    const [selectedPage, setSelectedPage] = useState<string>('Quotation');

    const renderContent = () => {
        switch (selectedPage) {
            case 'Quotation':
                return <Quotation />;
            case 'Vendor':
                return <Vendor />;
            case 'Cost':
                return <Cost />;
            default:
                return null;
        }
    };

    return (
        <Layout style={{
            height: '100vh',
            width: '100vw',
            border: 'none'
        }}>
            <Header />
            <Layout>
                <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)', border: 'none' }}>
                    <Nav
                        style={{ maxWidth: 220, height: '100%' }}
                        defaultSelectedKeys={['Quotation']}
                        selectedKeys={[selectedPage]}
                        items={[
                            { itemKey: 'Quotation', text: '询价邮件', icon: <IconMailStroked1 size="large" /> },
                            { itemKey: 'Vendor', text: '供应商查询', icon: <IconSearch size="large" /> },
                            { itemKey: 'Cost', text: '成本预估', icon: <IconCart size="large" /> },
                        ]}
                        onSelect={data => setSelectedPage(data.itemKey as string)}
                        footer={{
                            collapseButton: true,
                        }}
                    />
                </Sider>
                <Content
                    style={{
                        padding: '24px',
                        backgroundColor: 'var(--semi-color-bg-0)',
                    }}
                >
                    <div>
                        {renderContent()}
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default QuotationHelper;