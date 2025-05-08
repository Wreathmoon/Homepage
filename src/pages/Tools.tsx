import React from 'react';
import { IconHistogram, IconHome, IconLive, IconSetting } from '@douyinfe/semi-icons';
import { Breadcrumb, Layout, Nav, Card, CardGroup, Typography } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';

const Tools = () => {
    const { Footer, Sider, Content } = Layout;
    const { Text } = Typography;
    const navigate = useNavigate();

    const handleCardClick = () => {
        navigate('/tools/quotationhelper');
    };

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
                        padding: '48px',
                        backgroundColor: 'var(--semi-color-bg-0)',
                    }}
                >
                    <CardGroup spacing={96}>
                        <div onClick={handleCardClick} style={{ cursor: 'pointer' }}>
                            <Card
                                shadows='hover'
                                loading={false}
                                title='报价助手'
                                headerLine={false}
                                style={{ width: 400, height: 200 }}
                                headerExtraContent={<Text link>开始</Text>}
                            >
                                <p>快速生成产品询价邮件</p>
                                <p>查询维护供应商联系方式</p>
                            </Card>
                        </div>
                        <Card
                            shadows='hover'
                            loading={true}
                            headerLine={false}
                            style={{ width: 400, height: 200 }}
                        >
                            <Text>xxx</Text>
                        </Card>
                        <Card
                            shadows='hover'
                            loading={true}
                            headerLine={false}
                            style={{ width: 400, height: 200 }}
                        >
                            <Text>xxx</Text>
                        </Card>
                        <Card
                            shadows='hover'
                            loading={true}
                            headerLine={false}
                            style={{ width: 400, height: 200 }}
                        >
                            <Text>xxx</Text>
                        </Card>
                        <Card
                            shadows='hover'
                            loading={true}
                            headerLine={false}
                            style={{ width: 400, height: 200 }}
                        >
                            <Text>xxx</Text>
                        </Card>
                        <Card
                            shadows='hover'
                            loading={true}
                            headerLine={false}
                            style={{ width: 400, height: 200 }}
                        >
                            <Text>xxx</Text>
                        </Card>
                    </CardGroup>
                </Content>
            </Layout>
        </Layout>
    );
};

export default Tools;

