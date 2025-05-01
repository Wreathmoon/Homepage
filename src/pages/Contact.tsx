import { IconHistogram, IconHome, IconLive, IconSetting } from '@douyinfe/semi-icons';
import { Breadcrumb, Layout, Nav } from '@douyinfe/semi-ui';
import Header from '../components/Header';

const Contact = () => {
    const { Footer, Sider, Content } = Layout;

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
                        defaultSelectedKeys={['Contact']}
                        items={[
                            { itemKey: 'Contact', text: '联系', icon: <IconHome size="large" /> },
                            { itemKey: 'Histogram', text: '基础数据', icon: <IconHistogram size="large" /> },
                            { itemKey: 'Live', text: '测试功能', icon: <IconLive size="large" /> },
                            { itemKey: 'Setting', text: '设置', icon: <IconSetting size="large" /> },
                        ]}
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
                    <Breadcrumb
                        style={{
                            marginBottom: '24px',
                        }}
                        routes={['联系']}
                    />
                    <div
                        style={{
                            borderRadius: '10px',
                            border: '1px solid var(--semi-color-border)',
                            height: '376px',
                            padding: '32px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontSize: '24px',
                            fontWeight: 'bold'
                        }}
                    >
                        Contact
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default Contact; 