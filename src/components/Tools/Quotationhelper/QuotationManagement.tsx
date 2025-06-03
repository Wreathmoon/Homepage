import React, { useEffect, useState } from 'react';
import { 
    Typography, 
    Table, 
    Button, 
    Form, 
    Modal, 
    Toast,
    Popover,
    Space,
    Tabs,
    TabPane
} from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { 
    QuotationRecord,
    getQuotationList,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    uploadQuotationFile
} from '../../../services/quotation';
import DatabaseManager from './DatabaseManager';
import QuotationHistory from './QuotationHistory';
import QuotationImport from './QuotationImport';
import Vendor from './Vendor';

const { Title, Text } = Typography;

const QuotationManagement: React.FC = () => {
    const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
    const [visible, setVisible] = useState(false);
    const [editing, setEditing] = useState<QuotationRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeKey, setActiveKey] = useState('history');

    // 获取报价列表
    const fetchQuotations = async () => {
        setLoading(true);
        try {
            const data = await getQuotationList();
            setQuotations(data);
        } catch (error) {
            Toast.error('获取报价列表失败');
            console.error('Error fetching quotations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotations();
    }, []);

    // 处理删除
    const handleDelete = async (id: number) => {
        try {
            await deleteQuotation(id);
            Toast.success('删除成功');
            fetchQuotations();
        } catch (error) {
            Toast.error('删除失败');
            console.error('Error deleting quotation:', error);
        }
    };

    // 处理编辑
    const handleEdit = (record: QuotationRecord) => {
        setEditing(record);
        setVisible(true);
    };

    // 处理新增
    const handleAdd = () => {
        setEditing(null);
        setVisible(true);
    };

    // 处理表单提交
    const handleSubmit = async (values: any) => {
        try {
            if (editing) {
                await updateQuotation(editing.id, values);
                Toast.success('修改成功');
            } else {
                await addQuotation(values);
                Toast.success('添加成功');
            }
            setVisible(false);
            fetchQuotations();
        } catch (error) {
            Toast.error(editing ? '修改失败' : '添加失败');
            console.error('Error submitting form:', error);
        }
    };

    // 处理文件上传
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const response = await uploadQuotationFile(file);
            Toast.success(response.message || '报价文件上传成功');
            fetchQuotations();
        } catch (error: any) {
            let errorMessage = '文件上传失败';
            if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
                if (errorMessage.includes('The model is overloaded')) {
                    errorMessage = '大模型繁忙，请稍后再试';
                }
            }
            Toast.error(errorMessage);
            console.error('Error uploading file:', error);
        }
    };

    // 处理导入按钮点击
    const handleImportClick = () => {
        const inputElement = document.getElementById('quotation-upload-input');
        inputElement?.click();
    };

    // 详细信息弹出内容
    const DetailContent = ({ record }: { record: QuotationRecord }) => (
        <div style={{ padding: '16px', maxWidth: '400px' }}>
            <Title heading={6} style={{ marginBottom: '8px' }}>
                {record.name}
                <Text type={record.quote_validity > new Date().toISOString().split('T')[0] ? 'success' : 'danger'} style={{ marginLeft: '8px', fontSize: '12px' }}>
                    {record.quote_validity > new Date().toISOString().split('T')[0] ? '有效' : '已过期'}
                </Text>
            </Title>
            <div style={{ marginTop: '16px' }}>
                <Text strong>详细配置信息：</Text>
                <div style={{ 
                    whiteSpace: 'pre-line',
                    backgroundColor: 'var(--semi-color-fill-0)',
                    padding: '12px',
                    borderRadius: '6px',
                    marginTop: '8px',
                    fontSize: '14px'
                }}>
                    {record.notes || '暂无详细配置信息'}
                </div>
            </div>
        </div>
    );

    // 表格列定义
    const columns: ColumnProps<QuotationRecord>[] = [
        {
            title: '产品名称',
            dataIndex: 'name',
            width: 200,
            render: (text: string, record: QuotationRecord) => (
                <Popover
                    content={<DetailContent record={record} />}
                    trigger="click"
                    position="rightTop"
                    showArrow
                >
                    <Button 
                        theme="light" 
                        type="tertiary" 
                        icon={<IconMore />}
                        style={{ padding: '4px 8px' }}
                    >
                        {text}
                    </Button>
                </Popover>
            )
        },
        { title: '供应商', dataIndex: 'supplier', width: 150 },
        { 
            title: 'List Price', 
            dataIndex: 'list_price', 
            width: 120,
            render: (value: number | null) => value ? `¥${value.toFixed(2)}` : '-'
        },
        { 
            title: '报价单价', 
            dataIndex: 'quote_unit_price', 
            width: 120,
            render: (value: number) => `¥${value.toFixed(2)}`
        },
        { title: '数量', dataIndex: 'quantity', width: 80 },
        { 
            title: '折扣率', 
            dataIndex: 'discount_rate', 
            width: 100,
            render: (value: number | null) => value ? `${(value * 100).toFixed(0)}%` : '-'
        },
        { 
            title: '报价总价', 
            dataIndex: 'quote_total_price', 
            width: 120,
            render: (value: number) => `¥${value.toFixed(2)}`
        },
        { title: '报价有效期', dataIndex: 'quote_validity', width: 120 },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: any, record: QuotationRecord) => (
                <Space>
                    <Button theme="borderless" type="primary" onClick={() => handleEdit(record)}>编辑</Button>
                    <Button theme="borderless" type="danger" onClick={() => handleDelete(record.id)}>删除</Button>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '20px', background: 'var(--semi-color-bg-0)' }}>
            <Tabs 
                type="line"
                activeKey={activeKey}
                onChange={key => setActiveKey(key)}
                lazyRender={false}
                keepDOM={true}
            >
                <TabPane tab="历史报价查询" itemKey="history">
                    <QuotationHistory />
                </TabPane>
                <TabPane tab="报价导入" itemKey="import">
                    <QuotationImport />
                </TabPane>
                <TabPane tab="供应商查询" itemKey="vendor">
                    <Vendor />
                </TabPane>
                <TabPane tab="数据库管理" itemKey="database">
                    <DatabaseManager />
                </TabPane>
            </Tabs>
            <Title heading={2}>报价管理</Title>
            <div style={{ marginBottom: 16 }}>
                <Button type="primary" onClick={handleAdd} style={{ marginRight: 16 }}>新增</Button>
                <input
                    type="file"
                    id="quotation-upload-input"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept=".pdf,.xls,.xlsx,.doc,.docx"
                />
                <Button type="tertiary" onClick={handleImportClick}>导入报价</Button>
            </div>
            <Table 
                columns={columns} 
                dataSource={quotations} 
                rowKey="id" 
                pagination={false}
                loading={loading}
            />
            <Modal
                title={editing ? '编辑报价' : '新增报价'}
                visible={visible}
                onCancel={() => setVisible(false)}
                footer={null}
                width={600}
            >
                <Form
                    initValues={editing || {}}
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
                        formatter={(value) => `${value}%`}
                        parser={(value) => value!.replace('%', '')}
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
                        label="详细配置信息"
                        rows={6}
                    />
                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                        <Button type="tertiary" onClick={() => setVisible(false)} style={{ marginRight: 8 }}>
                            取消
                        </Button>
                        <Button type="primary" htmlType="submit">
                            确定
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default QuotationManagement; 