import React, { useState, useCallback, useEffect } from 'react';
import { 
    Typography, 
    Form, 
    Button, 
    Table,
    Select,
    Space,
    Input,
    Modal,
    Descriptions,
    Tag,
    Toast
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { IconDownload } from '@douyinfe/semi-icons';
import { getQuotationList, getQuotationDetail, downloadAttachment, mockQuotations } from '../../../services/quotationHistory';
import type { QuotationRecord, QuotationQueryParams } from '../../../services/quotationHistory';
import { PRODUCT_CATEGORIES } from '../../../services/vendor';

const { Title } = Typography;

interface DetailModalProps {
    visible: boolean;
    onClose: () => void;
    record: QuotationRecord | null;
}

const DetailModal: React.FC<DetailModalProps> = ({ visible, onClose, record }) => {
    if (!record) return null;

    const handleDownload = async (attachmentId: string, fileName: string) => {
        try {
            const blob = await downloadAttachment(attachmentId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            Toast.error('下载失败');
        }
    };

    return (
        <Modal
            title={`产品详情 - ${record.productName}`}
            visible={visible}
            onCancel={onClose}
            footer={null}
            width={800}
            bodyStyle={{ 
                maxHeight: '70vh',
                overflow: 'auto',
                padding: '24px'
            }}
        >
            <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
                {record.attachments && record.attachments.length > 0 && (
                    <div style={{ 
                        borderBottom: '1px solid var(--semi-color-border)',
                        paddingBottom: 16,
                        marginBottom: 16 
                    }}>
                        {record.attachments.map(attachment => (
                            <Button
                                key={attachment.id}
                                icon={<IconDownload />}
                                theme="solid"
                                type="primary"
                                onClick={() => handleDownload(attachment.id, attachment.name)}
                            >
                                下载原厂报价单
                            </Button>
                        ))}
                    </div>
                )}

                <div style={{ flex: 1 }}>
                    <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        background: 'var(--semi-color-fill-0)',
                        padding: 16,
                        borderRadius: 4,
                        fontSize: '14px',
                        lineHeight: '1.6',
                        margin: 0
                    }}>
                        {record.configDetail}
                    </pre>
                </div>
            </div>
        </Modal>
    );
};

const QuotationHistory: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [quotations, setQuotations] = useState<QuotationRecord[]>(mockQuotations);
    const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10, total: mockQuotations.length });
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<QuotationRecord | null>(null);

    useEffect(() => {
        const handleError = (e: ErrorEvent) => {
            if (e.message.includes('ResizeObserver')) {
                e.stopPropagation();
                return false;
            }
        };
        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, []);

    const fetchQuotations = useCallback(async (params: QuotationQueryParams) => {
        setLoading(true);
        try {
            const filteredData = mockQuotations.filter(item => {
                if (params.vendor && !item.vendor.toLowerCase().includes(params.vendor.toLowerCase())) return false;
                if (params.productType && !item.productName.toLowerCase().includes(params.productType.toLowerCase())) return false;
                if (params.productKeyword && !item.productName.toLowerCase().includes(params.productKeyword.toLowerCase())) return false;
                return true;
            });

            const start = (params.page - 1) * params.pageSize;
            const end = start + params.pageSize;
            const pageData = filteredData.slice(start, end);

            setQuotations(pageData);
            setPagination(prev => ({ ...prev, total: filteredData.length }));
        } catch (error) {
            Toast.error('获取报价记录失败');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSubmit = (values: Record<string, any>) => {
        const params: QuotationQueryParams = {
            ...values,
            page: pagination.currentPage,
            pageSize: pagination.pageSize
        };
        fetchQuotations(params);
    };

    const handleShowDetail = useCallback((record: QuotationRecord) => {
        setCurrentRecord(record);
        setTimeout(() => {
            setDetailVisible(true);
        }, 0);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setDetailVisible(false);
        setCurrentRecord(null);
    }, []);

    const columns: ColumnProps<QuotationRecord>[] = [
        {
            title: '产品名称',
            dataIndex: 'productName',
            width: 200
        },
        {
            title: '产品详解',
            dataIndex: 'productSpec',
            width: 200,
            render: (_text, record) => (
                <Button
                    theme="borderless"
                    type="primary"
                    onClick={() => handleShowDetail(record)}
                >
                    查看详情
                </Button>
            )
        },
        {
            title: '供应商',
            dataIndex: 'vendor',
            width: 150
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
            title: '状态',
            dataIndex: 'isValid',
            width: 100,
            render: (value: boolean) => (
                <Tag color={value ? 'green' : 'red'} type="light">
                    {value ? '有效' : '已过期'}
                </Tag>
            )
        },
        {
            title: '备注',
            dataIndex: 'remark',
            width: 150
        }
    ];

    return (
        <div style={{ padding: '20px' }}>
            <Title heading={3}>历史报价查询</Title>
            
            <Form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <Form.Select
                        field="productType"
                        label="产品类型"
                        style={{ width: 200 }}
                        placeholder="请选择"
                        showClear
                        optionList={PRODUCT_CATEGORIES.map(category => ({
                            label: category,
                            value: category
                        }))}
                    />
                    <Form.Select
                        field="region"
                        label="地区"
                        style={{ width: 200 }}
                        placeholder="请选择"
                        showClear
                        optionList={[
                            { label: '华北', value: '华北' },
                            { label: '华东', value: '华东' },
                            { label: '华南', value: '华南' },
                            { label: '西部', value: '西部' }
                        ]}
                    />
                    <Form.Input
                        field="productKeyword"
                        label="产品关键字"
                        style={{ width: 200 }}
                        placeholder="请输入"
                        showClear
                    />
                    <Form.Input
                        field="vendor"
                        label="供应商"
                        style={{ width: 200 }}
                        placeholder="请输入"
                        showClear
                    />
                    <Space>
                        <Button type="primary" htmlType="submit">
                            查询
                        </Button>
                        <Button htmlType="reset">
                            重置
                        </Button>
                    </Space>
                </div>
            </Form>

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
                scroll={{ x: 1500 }}
            />

            {currentRecord && (
                <DetailModal
                    visible={detailVisible}
                    onClose={handleCloseDetail}
                    record={currentRecord}
                />
            )}
        </div>
    );
};

export default QuotationHistory; 