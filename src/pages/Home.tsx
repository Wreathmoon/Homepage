import { IconHistogram, IconHome, IconLive, IconSetting } from '@douyinfe/semi-icons';
import { Breadcrumb, Layout, Nav } from '@douyinfe/semi-ui';
import Header from '../components/Header';

const Home = () => {
    const { Footer, Sider, Content } = Layout;

    return (
        <Layout style={{
            height: '100vh',
            width: '100vw',
            border: 'none'
        }}>
            <Header />
            <Layout>
                <Content
                    style={{
                        padding: '24px',
                        backgroundColor: 'var(--semi-color-bg-0)',
                    }}
                >
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
                        Home
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default Home;
