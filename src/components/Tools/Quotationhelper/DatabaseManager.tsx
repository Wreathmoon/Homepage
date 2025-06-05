import React, { useState, useEffect } from 'react';
import { 
    Table, 
    Button, 
    Typography, 
    Card, 
    Descriptions, 
    Modal, 
    Form,
    Input,
    InputNumber,
    DatePicker,
    Space,
    Toast,
    Tabs,
    TabPane
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconEdit, IconRefresh } from '@douyinfe/semi-icons';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';

const { Title, Text } = Typography;

interface DBStats {
    totalQuotations: number;
    supplierStats: Array<{ _id: string; count: number }>;
    recentQuotations: Array<{
        _id: string;
        name: string;
        supplier: string;
        quote_total_price: number;
        created_at: string;
    }>;
}

interface QuotationData {
    _id: string;
    name: string;
    supplier: string;
    list_price?: number;
    quote_unit_price: number;
    quantity: number;
    discount_rate?: number;
    quote_total_price: number;
    quote_validity: string;
    notes?: string;
    created_at: string;
}

interface PaginationState {
    currentPage: number;
    pageSize: number;
    total: number;
}

const DatabaseManager: React.FC = () => {
    const [stats, setStats] = useState<DBStats | null>(null);
    const [quotations, setQuotations] = useState<QuotationData[]>([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [editingQuotation, setEditingQuotation] = useState<QuotationData | null>(null);
    const [selectedRows, setSelectedRows] = useState<QuotationData[]>([]);
    const [pagination, setPagination] = useState<PaginationState>({ currentPage: 1, pageSize: 10, total: 0 });
    const [filter, setFilter] = useState<Record<string, any>>({});
    const [sort, setSort] = useState<Record<string, 1 | -1>>({ created_at: -1 });

    // 获取数据库统计信息
    const fetchStats = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/db/stats');
            const data = await response.json();
            setStats(data);
        } catch (error) {
            Toast.error('获取统计信息失败');
        }
    };

    // 获取报价记录
    const fetchQuotations = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/db/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filter,
                    sort,
                    limit: pagination.pageSize,
                    skip: (pagination.currentPage - 1) * pagination.pageSize
                })
            });
            const { data, total } = await response.json();
            setQuotations(data);
            setPagination(prev => ({ ...prev, total }));
        } catch (error) {
            Toast.error('获取报价记录失败');
        } finally {
            setLoading(false);
        }
    };

    // 批量删除
    const handleBatchDelete = async (records: QuotationData[] = selectedRows) => {
        try {
            await fetch('http://localhost:3001/api/db/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation: 'delete',
                    items: records.map(row => row._id)
                })
            });
            Toast.success('删除成功');
            fetchQuotations();
            fetchStats();
            setSelectedRows([]);
        } catch (error) {
            Toast.error('删除失败');
        }
    };

    // 处理表单提交
    const handleSubmit = async (values: Partial<QuotationData>) => {
        try {
            if (editingQuotation) {
                await fetch('http://localhost:3001/api/db/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        operation: 'update',
                        items: [{ ...values, _id: editingQuotation._id }]
                    })
                });
                Toast.success('更新成功');
            } else {
                await fetch('http://localhost:3001/api/db/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        operation: 'insert',
                        items: [values]
                    })
                });
                Toast.success('添加成功');
            }
            setVisible(false);
            fetchQuotations();
            fetchStats();
        } catch (error) {
            Toast.error(editingQuotation ? '更新失败' : '添加失败');
        }
    };

    // 表格列定义
    const columns: ColumnProps<QuotationData>[] = [
        {
            title: '产品名称',
            dataIndex: 'name',
            width: 200,
            sorter: (a?: QuotationData, b?: QuotationData) => {
                if (!a || !b) return 0;
                return a.name.localeCompare(b.name);
            }
        },
        {
            title: '供应商',
            dataIndex: 'supplier',
            width: 150,
            sorter: (a?: QuotationData, b?: QuotationData) => {
                if (!a || !b) return 0;
                return a.supplier.localeCompare(b.supplier);
            }
        },
        {
            title: 'List Price',
            dataIndex: 'list_price',
            width: 120,
            render: (value: number) => value ? `¥${value.toFixed(2)}` : '-'
        },
        {
            title: '报价单价',
            dataIndex: 'quote_unit_price',
            width: 120,
            render: (value: number) => `¥${value.toFixed(2)}`
        },
        {
            title: '数量',
            dataIndex: 'quantity',
            width: 80
        },
        {
            title: '折扣率',
            dataIndex: 'discount_rate',
            width: 100,
            render: (value: number) => value ? `${(value * 100).toFixed(0)}%` : '-'
        },
        {
            title: '报价总价',
            dataIndex: 'quote_total_price',
            width: 120,
            render: (value: number) => `¥${value.toFixed(2)}`
        },
        {
            title: '报价有效期',
            dataIndex: 'quote_validity',
            width: 120
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            width: 160,
            sorter: (a?: QuotationData, b?: QuotationData) => {
                if (!a || !b) return 0;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
        },
        {
            title: '操作',
            key: 'action',
            width: 120,
            render: (_: any, record: QuotationData) => (
                <Space>
                    <Button
                        theme="borderless"
                        type="primary"
                        icon={<IconEdit />}
                        onClick={() => {
                            setEditingQuotation(record);
                            setVisible(true);
                        }}
                    />
                    <Button
                        theme="borderless"
                        type="danger"
                        icon={<IconDelete />}
                        onClick={() => handleBatchDelete([record])}
                    />
                </Space>
            )
        }
    ];

    useEffect(() => {
        fetchStats();
        fetchQuotations();
    }, [pagination.currentPage, pagination.pageSize, filter, sort]);

    return (
        <div style={{ padding: '20px' }}>
            <Title heading={2}>数据库管理</Title>

            <Tabs type="line" style={{ marginBottom: 20 }}>
                <TabPane tab="数据概览" itemKey="overview">
                    {stats && (
                        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                            <Card title="基本统计">
                                <Descriptions row>
                                    <Descriptions.Item itemKey="总报价数">
                                        {stats.totalQuotations}
                                    </Descriptions.Item>
                                    <Descriptions.Item itemKey="供应商数">
                                        {stats.supplierStats.length}
                                    </Descriptions.Item>
                                </Descriptions>
                            </Card>
                            
                            <Card title="供应商统计">
                                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                                    {stats.supplierStats.map(stat => (
                                        <div key={stat._id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text>{stat._id}</Text>
                                            <Text type="secondary">{stat.count} 条报价</Text>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card title="最近报价">
                                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                                    {stats.recentQuotations.map(quote => (
                                        <div key={quote._id} style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text strong>{quote.name}</Text>
                                                <Text type="secondary">¥{quote.quote_total_price.toFixed(2)}</Text>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                                <Text type="tertiary">{quote.supplier}</Text>
                                                <Text type="tertiary">
                                                    {new Date(quote.created_at).toLocaleDateString()}
                                                </Text>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}
                </TabPane>

                <TabPane tab="数据管理" itemKey="management">
                    <div style={{ marginBottom: 16 }}>
                        <Space>
                            <Button 
                                type="primary" 
                                icon={<IconPlus />}
                                onClick={() => {
                                    setEditingQuotation(null);
                                    setVisible(true);
                                }}
                            >
                                新增记录
                            </Button>
                            <Button 
                                type="danger" 
                                icon={<IconDelete />}
                                disabled={selectedRows.length === 0}
                                onClick={() => handleBatchDelete()}
                            >
                                批量删除
                            </Button>
                            <Button 
                                icon={<IconRefresh />}
                                onClick={() => {
                                    fetchQuotations();
                                    fetchStats();
                                }}
                            >
                                刷新
                            </Button>
                        </Space>
                    </div>

                    <Table
                        columns={columns}
                        dataSource={quotations}
                        pagination={{
                            currentPage: pagination.currentPage,
                            pageSize: pagination.pageSize,
                            total: pagination.total,
                            onPageChange: page => setPagination(prev => ({ ...prev, currentPage: page }))
                        }}
                        loading={loading}
                        rowKey="_id"
                        rowSelection={{
                            selectedRowKeys: selectedRows.map(row => row._id),
                            onChange: (_, rows: QuotationData[] | undefined) => setSelectedRows(rows || [])
                        }}
                    />
                </TabPane>
            </Tabs>

            <Modal
                title={editingQuotation ? '编辑记录' : '新增记录'}
                visible={visible}
                onCancel={() => setVisible(false)}
                footer={null}
                width={600}
            >
                <Form
                    initValues={editingQuotation || {}}
                    onSubmit={handleSubmit}
                    style={{ padding: '16px' }}
                >
                    <Form.Input
                        field="name"
                        label="产品名称"
                        rules={[{ required: true, message: '请输入产品名称' }]}
                    />
                    <Form.Input
                        field="supplier"
                        label="供应商"
                        rules={[{ required: true, message: '请输入供应商' }]}
                    />
                    <Form.InputNumber
                        field="list_price"
                        label="List Price"
                        prefix="¥"
                    />
                    <Form.InputNumber
                        field="quote_unit_price"
                        label="报价单价"
                        prefix="¥"
                        rules={[{ required: true, message: '请输入报价单价' }]}
                    />
                    <Form.InputNumber
                        field="quantity"
                        label="数量"
                        rules={[{ required: true, message: '请输入数量' }]}
                    />
                    <Form.InputNumber
                        field="discount_rate"
                        label="折扣率"
                        formatter={(value: string | number) => {
                            if (typeof value === 'number') {
                                return `${(value * 100).toFixed(0)}%`;
                            }
                            return value;
                        }}
                        parser={(value: string) => {
                            const parsed = parseFloat(value.replace('%', '')) / 100;
                            return parsed.toString();
                        }}
                    />
                    <Form.InputNumber
                        field="quote_total_price"
                        label="报价总价"
                        prefix="¥"
                        rules={[{ required: true, message: '请输入报价总价' }]}
                    />
                    <Form.DatePicker
                        field="quote_validity"
                        label="报价有效期"
                        rules={[{ required: true, message: '请选择报价有效期' }]}
                    />
                    <Form.TextArea
                        field="notes"
                        label="备注"
                        rows={4}
                    />
                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                        <Space>
                            <Button type="tertiary" onClick={() => setVisible(false)}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                确定
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default DatabaseManager; 