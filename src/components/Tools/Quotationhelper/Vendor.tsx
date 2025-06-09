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
import { IconHelpCircle } from '@douyinfe/semi-icons';

import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';

import { getVendorList, getVendorProducts, PRODUCT_CATEGORIES } from '../../../services/vendor';
import type { VendorQueryParams, Vendor as VendorType } from '../../../services/vendor';

const { Title } = Typography;

// 定义筛选条件接口
interface FilterValues {
    country?: string;

    type?: 'HARDWARE' | 'SOFTWARE' | 'SERVICE';
    agentType?: 'GENERAL_AGENT' | 'AGENT' | 'DIRECT';
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
                case 'DIRECT':
                    isGeneralAgent = false;
                    isAgent = false;
                    break;
                default:
                    break;
            }

            const params: VendorQueryParams = {
                country: values.country,
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
                total: filteredData.length,

                currentPage: page,
                pageSize 
            }));
        } catch (error) {
            Toast.error('获取供应商列表失败');
        } finally {
            setLoading(false);
        }
    }, []);

    // 获取供应商产品

    const fetchVendorProducts = useCallback(async (vendorId: number) => {
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
            country: values.country,
            type: values.type,
            productCategory: values.productCategory,
            productKeyword: values.productKeyword,
            keyword: values.keyword,
            isGeneralAgent: values.agentType === 'GENERAL_AGENT',
            isAgent: values.agentType === 'AGENT',
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
                if (record.isGeneralAgent) return '总代理';
                if (record.isAgent) return '经销商';
                return '其他（安装、售后等）';
            },
            width: 100
        },
        { 
            title: '国家/地区', 
            dataIndex: 'country', 
            sorter: true,
            width: 120
        },
        { 
            title: '联系人', 
            dataIndex: 'contact',
            width: 120
        },
        {
            title: '网站',
            dataIndex: 'website',
            render: (website: string) => website ? (
                <a href={website} target="_blank" rel="noopener noreferrer">
                    访问网站
                </a>
            ) : '-',
            width: 100
        },
        {
            title: '供应品牌',
            dataIndex: 'brands',
            render: (brands: string[]) => brands.join(', '),
            width: 200
        },
        {
            title: '账号信息',
            render: (record: VendorType) => (
                <Tooltip content={`密码: ${record.password}`}>
                    {record.account}
                </Tooltip>
            ),
            width: 150
        },
        {
            title: '操作',
            fixed: 'right' as const,
            width: 120,
            render: (_: any, record: VendorType) => (
                <Button
                    theme="borderless"
                    type="primary"
                    onClick={() => {
                        setCurrentSupplier(record);
                        setProductsVisible(true);
                        fetchVendorProducts(record.id);
                    }}
                >
                    查看产品类型
                </Button>
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
                                { label: '服务供应商', value: 'SERVICE' }
                            ]}
                        />
                    </Col>
                    <Col span={6}>
                        <Form.Select
                            field="country"
                            label="国家/地区"
                            style={{ width: '100%' }}
                            placeholder="请选择"
                            showClear
                            optionList={[
                                { label: '中国', value: 'CN' },
                                { label: '美国', value: 'US' },
                                { label: '德国', value: 'DE' },
                                { label: '日本', value: 'JP' }
                            ]}
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
                                { label: '其他（安装、售后等）', value: 'DIRECT' }
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
                scroll={{ x: 1500 }}
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
        </div>
    );
};

export default Vendor; 
