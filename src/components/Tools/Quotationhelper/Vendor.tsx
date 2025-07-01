import React, { useState, useCallback, useEffect } from 'react';
import { 
    Typography, 
    Form, 
    Button, 
    Table,
    Select, 
    Input, 
    Modal,
    Toast,
    Spin,
    Tooltip,
    Row,
    Col,
    Space,
    Tag
} from '@douyinfe/semi-ui';
import { IconHelpCircle, IconEyeOpened, IconEyeClosed, IconKey } from '@douyinfe/semi-icons';

import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';

import { getVendorList, getVendorProducts, PRODUCT_CATEGORIES, VENDOR_REGIONS } from '../../../services/vendor';
import type { VendorQueryParams, Vendor as VendorType, VendorRegion } from '../../../services/vendor';

const { Title } = Typography;

// 定义筛选条件接口
interface FilterValues {
    region?: VendorRegion;
    type?: 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'DATACENTER' | 'OTHER';
    agentType?: 'GENERAL_AGENT' | 'AGENT' | 'OTHER';
    productCategory?: string;
    productKeyword?: string;
    keyword?: string;
}

const Vendor: React.FC = () => {
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState<VendorQueryParams>({ page: 1, pageSize: 10 });   
    const [suppliers, setSuppliers] = useState<VendorType[]>([]);
    const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10, total: 0 });
    const [productsVisible, setProductsVisible] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState<VendorType | null>(null);
    const [products, setProducts] = useState<string[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [currentVendorName, setCurrentVendorName] = useState('');
    const [remarksVisible, setRemarksVisible] = useState(false);
    const [currentRemarks, setCurrentRemarks] = useState('');
    const [contactsVisible, setContactsVisible] = useState(false);
    const [currentContacts, setCurrentContacts] = useState<any[]>([]);
    const [currentVendorForContacts, setCurrentVendorForContacts] = useState('');

    // 显示密码窗口
    const showPasswordModal = (vendor: VendorType) => {
        setCurrentPassword(vendor.password || '');
        setCurrentVendorName(vendor.name);
        setPasswordVisible(true);
    };

    // 显示联系人列表
    const handleShowContacts = (vendor: VendorType) => {
        setCurrentContacts(vendor.contacts || []);
        setCurrentVendorForContacts(vendor.name);
        setContactsVisible(true);
    };

    // 获取供应商列表
    const fetchSuppliers = useCallback(async (values: FilterValues, page: number, pageSize: number) => {
        setLoading(true);
        try {
            // 处理代理类型
            let isGeneralAgent: boolean | undefined;
            let isAgent: boolean | undefined;
            
            switch (values.agentType) {
                case 'GENERAL_AGENT':
                    isGeneralAgent = true;
                    isAgent = false;
                    break;
                case 'AGENT':
                    isGeneralAgent = false;
                    isAgent = true;
                    break;
                case 'OTHER':
                    isGeneralAgent = false;
                    isAgent = false;
                    break;
                default:
                    break;
            }

            const params: VendorQueryParams = {
                region: values.region,
                type: values.type,
                keyword: values.keyword,
                productCategory: values.productCategory,
                productKeyword: values.productKeyword,
                isGeneralAgent,
                isAgent,
                page,
                pageSize
            };

            const response = await getVendorList(params);

            
            // 如果有关键字，在前端进行额外过滤
            let filteredData = response.data;
            if (values.keyword) {
                const keyword = values.keyword.toLowerCase();
                filteredData = filteredData.filter(item => 
                    item.name.toLowerCase().includes(keyword) ||
                    item.brands.some(brand => brand.toLowerCase().includes(keyword)) ||
                    item.contact.toLowerCase().includes(keyword)
                );
            }
            
            setSuppliers(filteredData);
            setPagination(prev => ({ 
                ...prev, 
                total: response.total || filteredData.length,
                currentPage: page,
                pageSize 
            }));
        } catch (error) {
            console.error('获取供应商列表失败:', error);
            Toast.error('获取供应商列表失败');
        } finally {
            setLoading(false);
        }
    }, []);

    // 初始加载数据
    useEffect(() => {
        fetchSuppliers({}, 1, 10);
    }, [fetchSuppliers]);

    // 获取供应商产品
    const fetchVendorProducts = useCallback(async (vendorId: string | number) => {
        setProductsLoading(true);
        try {
            const response = await getVendorProducts(vendorId);
            setProducts(response.data);
        } catch (error) {
            Toast.error('获取产品列表失败');
        } finally {
            setProductsLoading(false);
        }
    }, []);

    // 重置按钮处理
    const handleReset = useCallback(() => {
        const initialFilters: VendorQueryParams = { page: 1, pageSize: pagination.pageSize };
        setFilters(initialFilters);
        fetchSuppliers({}, 1, pagination.pageSize);
    }, [pagination.pageSize, fetchSuppliers]);


    // 处理筛选条件提交
    const handleSubmit = (values: FilterValues) => {
        const params: VendorQueryParams = {
            region: values.region,
            type: values.type,
            productCategory: values.productCategory,
            productKeyword: values.productKeyword,
            keyword: values.keyword,
            agentType: values.agentType,
            page: 1,
            pageSize: pagination.pageSize
        };
        setFilters(params);
        fetchSuppliers(values, 1, pagination.pageSize);
    };

    // 表格列定义
    const columns: ColumnProps<VendorType>[] = [
        { 
            title: '供应商名称', 
            dataIndex: 'name', 
            sorter: true,
            width: 200
        },
        { 
            title: '供应商类型', 
            dataIndex: 'type',
            width: 120
        },
        {
            title: '代理类型',
            render: (record: VendorType) => {
                // 优先显示新的agentType字段
                if ((record as any).agentType) {
                    const agentType = (record as any).agentType;
                    if (agentType === 'GENERAL_AGENT') return '总代理';
                    if (agentType === 'AGENT') return '经销商';
                    return agentType; // 显示自定义代理类型
                }
                // 回退到旧的布尔字段
                if (record.isGeneralAgent) return '总代理';
                if (record.isAgent) return '经销商';
                return '其他';
            },
            width: 120
        },
        { 
            title: '地区', 
            dataIndex: 'region', 
            sorter: true,
            width: 120
        },
        { 
            title: '主要联系人', 
            dataIndex: 'contact',
            width: 120
        },
        { 
            title: '邮箱', 
            dataIndex: 'email',
            width: 180
        },
        {
            title: '所有联系人',
            render: (record: VendorType) => {
                const contactCount = record.contacts?.length || 0;
                if (contactCount === 0) {
                    return <span style={{ color: '#999' }}>无联系人</span>;
                }
                return (
                    <Button
                        theme="borderless"
                        type="primary"
                        size="small"
                        onClick={() => handleShowContacts(record)}
                    >
                        查看({contactCount}人)
                    </Button>
                );
            },
            width: 120
        },
        {
            title: '网站',
            dataIndex: 'website',
            render: (website: string) => {
                if (!website) return '-';
                
                // 确保URL有协议前缀
                let url = website;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                
                return (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                        访问网站
                    </a>
                );
            },
            width: 100
        },
        {
            title: '供应品牌',
            dataIndex: 'brands',
            render: (brands: string[]) => Array.isArray(brands) ? brands.join(', ') : (brands || '-'),
            width: 200
        },
        {
            title: '账号信息',
            render: (record: VendorType) => {
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{record.account || '无账号'}</span>
                        {record.password && (
                            <Button
                                theme="borderless"
                                type="tertiary"
                                size="small"
                                icon={<IconKey />}
                                onClick={() => showPasswordModal(record)}
                                style={{ padding: '2px 4px' }}
                            />
                        )}
                    </div>
                );
            },
            width: 200
        },
        {
            title: '备注/录入人',
            render: (record: VendorType) => {
                const entryPerson = (record as any).entryPerson;
                const remarks = record.remarks;
                
                if (!entryPerson && !remarks) {
                    return <span style={{ color: '#999' }}>-</span>;
                }
                
                return (
                    <div style={{ fontSize: '12px' }}>
                        {entryPerson && (
                            <div style={{ color: '#1890ff', marginBottom: '2px' }}>
                                录入人：{entryPerson}
                            </div>
                        )}
                        {remarks && (
                            <div style={{ color: '#666' }}>
                                {remarks.length > 20 ? 
                                    <Tooltip content={remarks}>
                                        <span style={{ cursor: 'pointer' }}>
                                            {remarks.substring(0, 20)}...
                                        </span>
                                    </Tooltip> : 
                                    remarks
                                }
                            </div>
                        )}
                    </div>
                );
            },
            width: 150
        },
        {
            title: '操作',
            fixed: 'right' as const,
            width: 180,
            render: (_: any, record: VendorType) => (
                <Space>
                    <Button
                        theme="borderless"
                        type="primary"
                        size="small"
                        onClick={() => {
                            setCurrentSupplier(record);
                            setProductsVisible(true);
                            // 直接显示产品类别，不需要额外API调用
                            const categories = Array.isArray(record.category) ? record.category : [];
                            setProducts(categories);
                        }}
                    >
                        查看产品类型
                    </Button>
                    <Button
                        theme="borderless"
                        type="secondary"
                        size="small"
                        onClick={() => {
                            // 组合备注和录入人信息
                            const entryPerson = (record as any).entryPerson;
                            const remarks = record.remarks || '';
                            
                            let combinedInfo = '';
                            if (entryPerson) {
                                combinedInfo += `录入人：${entryPerson}\n`;
                            }
                            if (remarks) {
                                combinedInfo += `备注：${remarks}`;
                            }
                            if (!combinedInfo) {
                                combinedInfo = '暂无备注信息';
                            }
                            
                            setCurrentRemarks(combinedInfo);
                            setRemarksVisible(true);
                        }}
                    >
                        查看备注
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '20px' }}>
            <Title heading={2}>供应商查询</Title>
            
            {/* 筛选条件区域 */}
            <Form<FilterValues>
                layout="horizontal"
                labelPosition="left"
                style={{ marginBottom: '20px' }}
                onSubmit={handleSubmit}
                onReset={() => handleReset()}
            >
                <Row style={{ marginBottom: 12 }}>
                    <Col span={6}>
                        <Form.Select
                            field="type"
                            label="供应商类型"
                            style={{ width: '100%' }}
                            placeholder="请选择"
                            showClear
                            optionList={[
                                { label: '硬件供应商', value: 'HARDWARE' },
                                { label: '软件供应商', value: 'SOFTWARE' },
                                { label: '服务供应商', value: 'SERVICE' },
                                { label: '数据中心', value: 'DATACENTER' },
                                { label: '其他', value: 'OTHER' }
                            ]}
                        />
                    </Col>
                    <Col span={6}>
                        <Form.Select
                            field="region"
                            label="国家/地区"
                            style={{ width: '100%' }}
                            placeholder="请选择"
                            showClear
                            optionList={VENDOR_REGIONS.map(region => ({
                                label: region,
                                value: region
                            }))}
                        />
                    </Col>
                    <Col span={6}>
                        <Form.Select
                            field="agentType"
                            label={
                                <span>
                                    代理类型
                                    <Tooltip content="供应商的代理资质类型">
                                        <IconHelpCircle style={{ marginLeft: 4 }} />
                                    </Tooltip>
                                </span>
                            }
                            style={{ width: '100%' }}
                            placeholder="请选择"
                            showClear
                            optionList={[
                                { label: '总代理', value: 'GENERAL_AGENT' },
                                { label: '经销商', value: 'AGENT' },
                                { label: '其他', value: 'OTHER' }
                            ]}
                        />
                    </Col>
                    <Col span={6}>
                        <Form.Select
                            field="productCategory"
                            label="产品类别"
                            style={{ width: '100%' }}
                            placeholder="请选择"
                            showClear
                            optionList={PRODUCT_CATEGORIES.map(category => ({
                                label: category,
                                value: category
                            }))}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col span={10}>
                        <Form.Input
                            field="productKeyword"
                            label="产品关键字"
                            placeholder="请输入产品关键字"
                            style={{ width: '100%' }}
                            showClear
                        />
                    </Col>
                    <Col span={10}>
                        <Form.Input
                            field="keyword"
                            label="供应商关键字"
                            placeholder="请输入供应商名称、品牌或关键字"
                            style={{ width: '100%' }}
                            showClear
                        />
                    </Col>
                    <Col span={4} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                查询
                            </Button>
                            <Button htmlType="reset">
                                重置
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Form>

            {/* 结果列表区域 */}
            <Table<VendorType>
                columns={columns}
                dataSource={suppliers}
                pagination={{
                    currentPage: pagination.currentPage,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    onPageChange: (page) => {
                        setPagination(prev => ({ ...prev, currentPage: page }));
                        fetchSuppliers(filters, page, pagination.pageSize);
                    }
                }}
                loading={loading}
                scroll={{ x: 1600 }}
                empty={
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        暂无符合条件的供应商
                    </div>
                }
            />

            {/* 产品列表模态框 */}
            <Modal
                visible={productsVisible}
                title={`产品类型 - ${currentSupplier?.name}`}
                onCancel={() => setProductsVisible(false)}
                footer={null}
                width={600}
            >
                <Spin spinning={productsLoading}>
                    <div style={{ padding: '16px' }}>
                        {products.length > 0 ? (
                            <Space wrap>
                                {products.map((product, index) => (
                                    <Tag key={index} color="blue" type="light">
                                        {product}
                                    </Tag>
                                ))}
                            </Space>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--semi-color-text-2)' }}>
                                暂无产品记录
                            </div>
                        )}
                    </div>
                </Spin>
            </Modal>

            {/* 密码查看模态框 */}
            <Modal
                visible={passwordVisible}
                title={`查看密码 - ${currentVendorName}`}
                onCancel={() => setPasswordVisible(false)}
                footer={null}
                width={400}
            >
                <div style={{ padding: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                        <Typography.Text strong>账号密码：</Typography.Text>
                    </div>
                    <div style={{ 
                        padding: '12px', 
                        backgroundColor: 'var(--semi-color-fill-0)',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        wordBreak: 'break-all'
                    }}>
                        {currentPassword || '暂无密码'}
                    </div>
                    <div style={{ marginTop: '16px', textAlign: 'right' }}>
                        <Button 
                            type="primary" 
                            onClick={() => setPasswordVisible(false)}
                        >
                            关闭
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* 备注模态框 */}
            <Modal
                visible={remarksVisible}
                title="备注信息 & 录入人"
                onCancel={() => setRemarksVisible(false)}
                footer={null}
                width={500}
            >
                <div style={{ padding: '16px' }}>
                    <div style={{ 
                        padding: '12px', 
                        backgroundColor: 'var(--semi-color-fill-0)',
                        borderRadius: '6px',
                        minHeight: '80px',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {currentRemarks || '暂无备注'}
                    </div>
                </div>
            </Modal>

            {/* 联系人列表模态框 */}
            <Modal
                visible={contactsVisible}
                title={`联系人列表 - ${currentVendorForContacts}`}
                onCancel={() => setContactsVisible(false)}
                footer={null}
                width={800}
            >
                <div style={{ padding: '16px' }}>
                    {currentContacts.length > 0 ? (
                        <Table
                            dataSource={currentContacts}
                            pagination={false}
                            size="small"
                            columns={[
                                {
                                    title: '姓名',
                                    dataIndex: 'name',
                                    width: 120
                                },
                                {
                                    title: '职位',
                                    dataIndex: 'position',
                                    width: 100,
                                    render: (text) => text || '-'
                                },
                                {
                                    title: '电话',
                                    dataIndex: 'phone',
                                    width: 140
                                },
                                {
                                    title: '邮箱',
                                    dataIndex: 'email',
                                    width: 180
                                },
                                {
                                    title: '主要联系人',
                                    dataIndex: 'isPrimary',
                                    width: 100,
                                    render: (isPrimary: boolean) => (
                                        <Tag color={isPrimary ? 'blue' : 'grey'} type="light">
                                            {isPrimary ? '是' : '否'}
                                        </Tag>
                                    )
                                },
                                {
                                    title: '备注',
                                    dataIndex: 'remarks',
                                    render: (text) => {
                                        if (!text) return '-';
                                        return (
                                            <Tooltip content={text}>
                                                <span style={{ cursor: 'pointer' }}>
                                                    {text.length > 15 ? text.substring(0, 15) + '...' : text}
                                                </span>
                                            </Tooltip>
                                        );
                                    }
                                }
                            ]}
                        />
                    ) : (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '40px', 
                            color: 'var(--semi-color-text-2)' 
                        }}>
                            该供应商暂无联系人信息
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Vendor; 
