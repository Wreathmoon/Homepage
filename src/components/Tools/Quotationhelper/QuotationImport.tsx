import React, { useState } from 'react';
import { 
    Typography, 
    Form, 
    Button, 
    Table,
    Space,
    Tooltip,
    Modal,
    Toast,
    Upload
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { IconUpload } from '@douyinfe/semi-icons';
import { request } from '../../../utils/request';
import { BeforeUploadProps } from '@douyinfe/semi-ui/lib/es/upload';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';

const { Title, Text } = Typography;

interface ImportedQuotation {
    id: number;
    name: string;                 // 产品名
    supplier: string;             // 供应商
    list_price: number | null;    // List Price
    quote_unit_price: number;     // 报价单价
    quantity: number;             // 数量
    discount_rate: number | null; // 折扣率
    quote_total_price: number;    // 报价总价
    quote_validity: string;       // 报价有效期
    notes: string | null;         // 备注（包含详细配置信息）
}

interface QuotationFormData {
    name: string;                 // 产品名
    supplier: string;             // 供应商
    list_price?: number;          // List Price
    quote_unit_price: number;     // 报价单价
    quantity: number;             // 数量
    quote_total_price: number;    // 报价总价
    quote_validity: string;       // 报价有效期
    notes?: string;              // 备注
}

const QuotationImport: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [quotations, setQuotations] = useState<ImportedQuotation[]>([]);
    const [visible, setVisible] = useState(false);
    const [editing, setEditing] = useState<ImportedQuotation | null>(null);
    const [form, setForm] = useState<FormApi<QuotationFormData>>();

    const handleSubmit = async (values: QuotationFormData) => {
        setLoading(true);
        try {
            await request('/api/products', {
                method: 'POST',
                data: values
            });
            Toast.success('报价记录添加成功');
            form?.reset();
        } catch (error) {
            Toast.error('添加失败，请重试');
            console.error('添加报价记录失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (file: BeforeUploadProps) => {
        const formData = new FormData();
        formData.append('file', file.file as any);

        try {
            const response = await request('/api/upload-quotation', {
                method: 'POST',
                body: formData
            });
            Toast.success('文件上传成功');
            setQuotations(response.data.data || []);
            return response;
        } catch (error) {
            Toast.error('文件上传失败，请重试');
            return false;
        }
    };

    // 处理编辑
    const handleEdit = (record: ImportedQuotation) => {
        setEditing(record);
        setVisible(true);
    };

    // 处理删除
    const handleDelete = async (id: number) => {
        try {
            await fetch(`http://localhost:3001/api/products/${id}`, { method: 'DELETE' });
            Toast.success('删除成功');
            setQuotations(quotations.filter(q => q.id !== id));
        } catch (error) {
            Toast.error('删除失败');
            console.error('Error deleting quotation:', error);
        }
    };

    // 表格列定义
    const columns: ColumnProps<ImportedQuotation>[] = [
        {
            title: '产品名称',
            dataIndex: 'name',
            width: 200
        },
        {
            title: '供应商',
            dataIndex: 'supplier',
            width: 150
        },
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
        {
            title: '数量',
            dataIndex: 'quantity',
            width: 80
        },
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
        {
            title: '报价有效期',
            dataIndex: 'quote_validity',
            width: 120
        },
        {
            title: '备注',
            dataIndex: 'notes',
            width: 200,
            ellipsis: {
                showTitle: false
            },
            render: (text: string) => (
                <Tooltip content={text}>
                    {text}
                </Tooltip>
            )
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: any, record: ImportedQuotation) => (
                <Space>
                    <Button theme="borderless" type="primary" onClick={() => handleEdit(record)}>编辑</Button>
                    <Button theme="borderless" type="danger" onClick={() => handleDelete(record.id)}>删除</Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '20px', maxWidth: 800, margin: '0 auto' }}>
            <Title heading={3}>报价上传</Title>
            
            <div style={{ marginBottom: 40 }}>
                <Title heading={5} style={{ marginBottom: 16 }}>批量上传</Title>
                <Upload
                    action=""
                    beforeUpload={handleUpload}
                    accept=".xlsx,.xls,.csv"
                    uploadTrigger="custom"
                    showUploadList
                    draggable
                    dragMainText={
                        <div style={{ textAlign: 'center' }}>
                            <IconUpload size="extra-large" />
                            <div style={{ marginTop: 8, color: 'var(--semi-color-text-2)' }}>
                                点击上传或拖拽文件到这里
                            </div>
                        </div>
                    }
                    dragSubText="支持 .xlsx, .xls, .csv 格式的文件"
                />
            </div>

            <div>
                <Title heading={5} style={{ marginBottom: 16 }}>手动添加</Title>
                <Form<QuotationFormData>
                    getFormApi={setForm}
                    onSubmit={handleSubmit}
                    style={{ width: '100%' }}
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
                        min={1}
                        rules={[{ required: true, message: '请输入数量' }]}
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
                        type="date"
                        rules={[{ required: true, message: '请选择报价有效期' }]}
                    />
                    <Form.TextArea
                        field="notes"
                        label="备注"
                        rows={4}
                    />
                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                        <Space>
                            <Button type="tertiary" onClick={() => form?.reset()}>
                                重置
                            </Button>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                提交
                            </Button>
                        </Space>
                    </div>
                </Form>
            </div>

            <Table 
                columns={columns} 
                dataSource={quotations} 
                rowKey="id" 
                pagination={false}
                loading={loading}
                empty={
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        暂无导入的报价记录
                    </div>
                }
            />

            <Modal
                title="编辑报价"
                visible={visible}
                onCancel={() => setVisible(false)}
                footer={null}
                width={600}
            >
                <Form
                    initValues={editing || {}}
                    onSubmit={(values) => {
                        handleSubmit(values as QuotationFormData);
                    }}
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

export default QuotationImport; 