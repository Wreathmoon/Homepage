import React, { useState, useRef } from 'react';
import { 
    Typography, 
    Form, 
    Button, 
    Table,
    Space,
    Tooltip,
    Modal,
    Toast,
    Upload,
    Card
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { IconUpload } from '@douyinfe/semi-icons';
import { request } from '../../../utils/request';
import { BeforeUploadProps, BeforeUploadObjectResult } from '@douyinfe/semi-ui/lib/es/upload';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';
import type { QuotationRecord } from '../../../services/quotationHistory';
import { PRODUCT_CATEGORIES, REGIONS } from '../../../services/quotationHistory';

const { Title, Text } = Typography;

interface QuotationFormData {
    productName: string;
    vendor: string;
    category: string;
    region: string;
    productSpec: string;
    originalPrice: number;
    finalPrice: number;
    quantity: number;
    discount: number;
    quotationDate: string;
    remark?: string;
}

const QuotationImport: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
    const [visible, setVisible] = useState(false);
    const [editing, setEditing] = useState<QuotationRecord | null>(null);
    const formRef = useRef<FormApi<QuotationFormData>>();

    const handleSubmit = async (values: QuotationFormData) => {
        setLoading(true);
        try {
            const response = await request.post('/api/quotations', values);
            Toast.success('报价记录添加成功');
            formRef.current?.reset();
            // 刷新列表
            const newQuotation = response.data;
            setQuotations([...quotations, newQuotation]);
        } catch (error) {
            Toast.error('添加失败，请重试');
            console.error('添加报价记录失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (file: BeforeUploadProps): Promise<BeforeUploadObjectResult> => {
        const formData = new FormData();
        formData.append('file', file.file as unknown as File);

        try {
            const response = await request.post('/api/quotations/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            Toast.success('文件上传成功');
            setQuotations(response.data || []);
            return {
                status: 'upload'
            };
        } catch (error) {
            Toast.error('文件上传失败，请重试');
            return {
                status: 'upload'
            };
        }
    };

    // 处理编辑
    const handleEdit = (record: QuotationRecord) => {
        setEditing(record);
        formRef.current?.setValues({
            productName: record.productName,
            vendor: record.vendor,
            category: record.category,
            region: record.region,
            productSpec: record.productSpec,
            originalPrice: record.originalPrice,
            finalPrice: record.finalPrice,
            quantity: record.quantity,
            discount: record.discount,
            quotationDate: record.quotationDate,
            remark: record.remark
        });
        setVisible(true);
    };

    // 处理删除
    const handleDelete = async (id: string) => {
        try {
            await request.delete(`/api/quotations/${id}`);
            Toast.success('删除成功');
            setQuotations(quotations.filter(q => q.id !== id));
        } catch (error) {
            Toast.error('删除失败');
            console.error('Error deleting quotation:', error);
        }
    };

    // 表格列定义
    const columns: ColumnProps<QuotationRecord>[] = [
        {
            title: '产品名称',
            dataIndex: 'productName',
            width: 200
        },
        {
            title: '供应商',
            dataIndex: 'vendor',
            width: 150
        },
        {
            title: '产品类别',
            dataIndex: 'category',
            width: 120
        },
        {
            title: '地区',
            dataIndex: 'region',
            width: 100
        },
        {
            title: '单价(折前)',
            dataIndex: 'originalPrice',
            width: 120,
            render: (value: number) => `¥${value.toFixed(2)}`
        },
        {
            title: '到手价',
            dataIndex: 'finalPrice',
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
            dataIndex: 'discount',
            width: 100,
            render: (value: number) => `${(value * 100).toFixed(0)}%`
        },
        {
            title: '报价时间',
            dataIndex: 'quotationDate',
            width: 120
        },
        {
            title: '备注',
            dataIndex: 'remark',
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
            render: (_: any, record: QuotationRecord) => (
                <Space>
                    <Button theme="borderless" type="primary" onClick={() => handleEdit(record)}>编辑</Button>
                    <Button theme="borderless" type="danger" onClick={() => handleDelete(record.id)}>删除</Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '20px' }}>
            <Title heading={3}>报价记录导入</Title>
            
            <Card style={{ 
                background: 'var(--semi-color-bg-1)',
                marginTop: '20px',
                borderRadius: '6px'
            }}>
                <Form.Section text="导入报价单">
                    <Upload
                        action=""
                        beforeUpload={handleUpload}
                        draggable
                        accept=".xlsx,.xls"
                        limit={1}
                        dragMainText="点击上传或拖拽报价单到这里"
                        dragSubText="支持 Excel 格式"
                        style={{
                            marginTop: '16px',
                            border: '2px dashed var(--semi-color-primary)',
                            borderRadius: '6px',
                            padding: '20px'
                        }}
                    />
                </Form.Section>
            </Card>

            <Card style={{ 
                background: 'var(--semi-color-bg-1)',
                marginTop: '20px',
                borderRadius: '6px'
            }}>
                <Form getFormApi={formApi => formRef.current = formApi} onSubmit={handleSubmit}>
                    <Form.Section text="手动添加">
                        <Form.Input
                            field="productName"
                            label="产品名称"
                            placeholder="请输入产品名称"
                            rules={[{ required: true, message: '请输入产品名称' }]}
                        />
                        <Form.Input
                            field="vendor"
                            label="供应商"
                            placeholder="请输入供应商名称"
                            rules={[{ required: true, message: '请输入供应商名称' }]}
                        />
                        <Form.Select
                            field="category"
                            label="产品类别"
                            placeholder="请选择产品类别"
                            rules={[{ required: true, message: '请选择产品类别' }]}
                            optionList={PRODUCT_CATEGORIES.map(cat => ({
                                label: cat,
                                value: cat
                            }))}
                        />
                        <Form.Select
                            field="region"
                            label="地区"
                            placeholder="请选择地区"
                            rules={[{ required: true, message: '请选择地区' }]}
                            optionList={REGIONS.map(region => ({
                                label: region,
                                value: region
                            }))}
                        />
                        <Form.TextArea
                            field="productSpec"
                            label="产品规格"
                            placeholder="请输入产品规格详情"
                            rules={[{ required: true, message: '请输入产品规格' }]}
                        />
                        <Form.InputNumber
                            field="originalPrice"
                            label="原始单价"
                            placeholder="请输入原始单价"
                            rules={[{ required: true, message: '请输入原始单价' }]}
                            formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/¥\s?|(,*)/g, '')}
                        />
                        <Form.InputNumber
                            field="finalPrice"
                            label="最终单价"
                            placeholder="请输入最终单价"
                            rules={[{ required: true, message: '请输入最终单价' }]}
                            formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/¥\s?|(,*)/g, '')}
                        />
                        <Form.InputNumber
                            field="quantity"
                            label="数量"
                            placeholder="请输入数量"
                            rules={[{ required: true, message: '请输入数量' }]}
                        />
                        <Form.InputNumber
                            field="discount"
                            label="折扣率"
                            placeholder="请输入折扣率"
                            rules={[{ required: true, message: '请输入折扣率' }]}
                            formatter={value => `${value}%`}
                            parser={value => value!.replace('%', '')}
                            max={100}
                            min={0}
                        />
                        <Form.DatePicker
                            field="quotationDate"
                            label="报价日期"
                            placeholder="请选择报价日期"
                            rules={[{ required: true, message: '请选择报价日期' }]}
                        />
                        <Form.TextArea
                            field="remark"
                            label="备注"
                            placeholder="请输入备注信息"
                        />
                        <Button type="primary" htmlType="submit" loading={loading}>
                            提交
                        </Button>
                    </Form.Section>
                </Form>
            </Card>

            <Table
                style={{ marginTop: '20px' }}
                columns={columns}
                dataSource={quotations}
                pagination={{
                    pageSize: 10
                }}
                loading={loading}
                scroll={{ x: 1500 }}
            />

            <Modal
                title="编辑报价记录"
                visible={visible}
                onOk={() => {
                    formRef.current?.submitForm();
                    setVisible(false);
                }}
                onCancel={() => {
                    setVisible(false);
                    setEditing(null);
                    formRef.current?.reset();
                }}
                confirmLoading={loading}
                width={800}
            >
                <Form getFormApi={formApi => formRef.current = formApi} onSubmit={handleSubmit}>
                    <Form.Section text="编辑报价记录">
                        {/* 编辑表单内容与添加表单相同 */}
                        <Form.Input
                            field="productName"
                            label="产品名称"
                            placeholder="请输入产品名称"
                            rules={[{ required: true, message: '请输入产品名称' }]}
                        />
                        <Form.Input
                            field="vendor"
                            label="供应商"
                            placeholder="请输入供应商名称"
                            rules={[{ required: true, message: '请输入供应商名称' }]}
                        />
                        <Form.Select
                            field="category"
                            label="产品类别"
                            placeholder="请选择产品类别"
                            rules={[{ required: true, message: '请选择产品类别' }]}
                            optionList={PRODUCT_CATEGORIES.map(cat => ({
                                label: cat,
                                value: cat
                            }))}
                        />
                        <Form.Select
                            field="region"
                            label="地区"
                            placeholder="请选择地区"
                            rules={[{ required: true, message: '请选择地区' }]}
                            optionList={REGIONS.map(region => ({
                                label: region,
                                value: region
                            }))}
                        />
                        <Form.TextArea
                            field="productSpec"
                            label="产品规格"
                            placeholder="请输入产品规格详情"
                            rules={[{ required: true, message: '请输入产品规格' }]}
                        />
                        <Form.InputNumber
                            field="originalPrice"
                            label="原始单价"
                            placeholder="请输入原始单价"
                            rules={[{ required: true, message: '请输入原始单价' }]}
                            formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/¥\s?|(,*)/g, '')}
                        />
                        <Form.InputNumber
                            field="finalPrice"
                            label="最终单价"
                            placeholder="请输入最终单价"
                            rules={[{ required: true, message: '请输入最终单价' }]}
                            formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/¥\s?|(,*)/g, '')}
                        />
                        <Form.InputNumber
                            field="quantity"
                            label="数量"
                            placeholder="请输入数量"
                            rules={[{ required: true, message: '请输入数量' }]}
                        />
                        <Form.InputNumber
                            field="discount"
                            label="折扣率"
                            placeholder="请输入折扣率"
                            rules={[{ required: true, message: '请输入折扣率' }]}
                            formatter={value => `${value}%`}
                            parser={value => value!.replace('%', '')}
                            max={100}
                            min={0}
                        />
                        <Form.DatePicker
                            field="quotationDate"
                            label="报价日期"
                            placeholder="请选择报价日期"
                            rules={[{ required: true, message: '请选择报价日期' }]}
                        />
                        <Form.TextArea
                            field="remark"
                            label="备注"
                            placeholder="请输入备注信息"
                        />
                    </Form.Section>
                </Form>
            </Modal>
        </div>
    );
};

export default QuotationImport; 