import React, { useState } from 'react';
import { IconMailStroked1, IconSearch, IconHistory, IconUpload, IconPlus, IconUserGroup } from '@douyinfe/semi-icons';
import { Layout, Nav } from '@douyinfe/semi-ui';
import Header from '../components/Header';
import Quotation from '../components/Tools/Quotationhelper/Quotation';
import Vendor from '../components/Tools/Quotationhelper/Vendor';
import VendorAdd from '../components/Tools/Quotationhelper/VendorAdd';
import QuotationHistory from '../components/Tools/Quotationhelper/QuotationHistory';
import QuotationImport from '../components/Tools/Quotationhelper/QuotationImport';
import UserManagement from '../components/UserManagement';
import { useAuth } from '../contexts/AuthContext';
import { VendorEditProvider } from '../contexts/VendorEditContext';
import type { Vendor as VendorType } from '../services/vendor';
import Logs from './Logs';

const { Footer, Sider, Content } = Layout;

const QuotationHelper = () => {
    const { isAdmin } = useAuth();
    const [selectedPage, setSelectedPage] = useState<string>('Quotation');
    const [editVendor, setEditVendor] = useState<VendorType | null>(null);

    const goToVendorList = () => setSelectedPage('Vendor');
    const goToVendorAdd = () => setSelectedPage('VendorAdd');

    // 处理账号管理
    const handleUserManagement = () => {
        setSelectedPage('UserManagement');
    };

    const renderContent = () => {
        switch (selectedPage) {
            case 'Quotation':
                return <Quotation />;
            case 'Vendor':
                return <Vendor />;
            case 'VendorAdd':
                return <VendorAdd />;
            case 'History':
                return <QuotationHistory />;
            case 'Import':
                return <QuotationImport />;
            case 'UserManagement':
                return <UserManagement />;
            case 'Logs':
                return <Logs />;
            default:
                return (
                    <div style={{ 
                        padding: '20px', 
                        fontSize: '24px', 
                        textAlign: 'center',
                        background: '#f0f0f0',
                        minHeight: '100vh'
                    }}>
                        <h1>报价助手测试页面</h1>
                        <p>当前选择: {selectedPage}</p>
                        <p>如果你能看到这个页面，说明QuotationHelper基本结构正常。</p>
                    </div>
                );
        }
    };

    return (
        <Layout style={{ height: '100%', border: 'none' }}>
            <Header onUserManagement={handleUserManagement} />
            <Layout style={{ height: '100%', marginTop: '60px' }}>
                <Sider style={{ 
                    backgroundColor: 'var(--semi-color-bg-1)', 
                    border: 'none',
                    height: 'calc(100vh - 60px)',
                    position: 'fixed',
                    left: 0,
                    top: '60px',
                    zIndex: 100
                }}>
                    <Nav
                        style={{ maxWidth: 220, height: '100%' }}
                        defaultSelectedKeys={['Quotation']}
                        selectedKeys={[selectedPage]}
                        items={[
                            { itemKey: 'Quotation', text: '询价邮件', icon: <IconMailStroked1 size="large" /> },
                            { itemKey: 'Vendor', text: '供应商查询', icon: <IconSearch size="large" /> },
                            { itemKey: 'VendorAdd', text: '供应商录入', icon: <IconPlus size="large" /> },
                            { itemKey: 'History', text: '历史报价', icon: <IconHistory size="large" /> },
                            { itemKey: 'Import', text: '报价上传', icon: <IconUpload size="large" /> },
                            ...(isAdmin ? [{ itemKey: 'Logs', text: '系统日志', icon: <IconHistory size="large" /> }] : []),
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
                        minHeight: 'calc(100vh - 60px)',
                        marginLeft: '220px',
                        overflowX: 'hidden'
                    }}
                >
                    <VendorEditProvider goToVendorList={goToVendorList} goToVendorAdd={goToVendorAdd}>
                        {renderContent()}
                    </VendorEditProvider>
                </Content>
            </Layout>
        </Layout>
    );
};

export default QuotationHelper;