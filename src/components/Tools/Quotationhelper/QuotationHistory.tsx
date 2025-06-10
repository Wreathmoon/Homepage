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
import { IconDownload, IconFile } from '@douyinfe/semi-icons';
import { 
    getQuotationList, 
    getQuotationDetail, 
    downloadAttachment, 
    mockQuotations,
    PRODUCT_CATEGORIES,
    REGIONS
} from '../../../services/quotationHistory';
import type { QuotationRecord, QuotationQueryParams } from '../../../services/quotationHistory';
import { ResizeObserverFix } from '../../../utils/resizeObserver';
import { request } from '../../../utils/request';

const { Title } = Typography;

interface DetailModalProps {
    visible: boolean;
    onClose: () => void;
    record: QuotationRecord | null;
}

const DetailModal: React.FC<DetailModalProps> = ({ visible, onClose, record }) => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (visible && record) {
            requestAnimationFrame(() => {
                setReady(true);
            });
        } else {
            setReady(false);
        }
    }, [visible, record]);

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

    // 下载原始文件
    const handleDownloadOriginal = async () => {
        try {
            Toast.info('正在准备下载...');
            const aiServerUrl = process.env.REACT_APP_AI_SERVER_URL || 'http://localhost:3002';
            const response = await fetch(`${aiServerUrl}/api/quotations/download/${record.id}`);
            
            if (!response.ok) {
                throw new Error('下载失败');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // 从响应头获取文件名，如果没有则使用默认名称
            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = `${record.productName}_原始报价单`;
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    fileName = decodeURIComponent(matches[1].replace(/['"]/g, ''));
                }
            }
            
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            Toast.success('下载成功');
        } catch (error) {
            console.error('下载原始文件失败:', error);
            Toast.error('下载失败，原始文件可能不存在');
        }
    };

    return (
        <Modal
            title={`产品详情 - ${record.productName}`}
            visible={visible}
            onCancel={onClose}
            footer={null}
            width={800}
            zIndex={1050}
            style={{ 
                top: '5vh'
            }}
            bodyStyle={{
                maxHeight: '85vh',
                overflow: ready ? 'auto' : 'hidden',
                padding: '20px',
                opacity: ready ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out'
            }}
            maskStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(2px)'
            }}
            getPopupContainer={() => document.body}
        >
            <div style={{ 
                padding: '0 4px',
                transform: ready ? 'none' : 'translateY(20px)',
                transition: 'transform 0.3s ease-out',
            }}>
                {/* 原始文件下载区域 */}
                <div style={{
                    marginBottom: '20px',
                    paddingBottom: '20px',
                    borderBottom: '1px solid var(--semi-color-border)'
                }}>
                    <Button
                        icon={<IconFile />}
                        theme="solid"
                        type="primary"
                        onClick={handleDownloadOriginal}
                        style={{ marginRight: '8px' }}
                    >
                        下载原始报价单
                    </Button>
                    
                    {record.attachments && record.attachments.length > 0 && (
                        record.attachments.map(attachment => (
                            <Button
                                key={attachment.id}
                                icon={<IconDownload />}
                                theme="outline"
                                type="secondary"
                                onClick={() => handleDownload(attachment.id, attachment.name)}
                                style={{ marginLeft: '8px' }}
                            >
                                {attachment.name}
                            </Button>
                        ))
                    )}
                </div>

                <div>
                    <div style={{
                        fontSize: '14px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        background: 'var(--semi-color-fill-0)',
                        padding: '16px',
                        borderRadius: '4px',
                        maxHeight: '60vh',
                        overflow: 'auto'
                    }}>
                        {record.configDetail || record.productSpec}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const QuotationHistory: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
    const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10, total: 0 });
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<QuotationRecord | null>(null);
    const [filters, setFilters] = useState<Partial<QuotationQueryParams>>({});

    const fetchData = useCallback(async (page: number, pageSize: number, filters: Partial<QuotationQueryParams>) => {
        setLoading(true);
        try {
            // 使用getQuotationList服务函数
            const response = await getQuotationList({
                page,
                pageSize,
                ...filters
            });
            
            setQuotations(response.data);
            setPagination(prev => ({ 
                ...prev, 
                total: response.total,
                currentPage: page,
                pageSize
            }));
        } catch (error) {
            console.error('获取报价记录失败:', error);
            Toast.error('获取报价记录失败');
        } finally {
            setLoading(false);
        }
    }, []);

    // 初始加载数据
    useEffect(() => {
        fetchData(1, 10, {});
    }, [fetchData]);

    // 监听filters和pagination变化，触发数据获取
    useEffect(() => {
        fetchData(pagination.currentPage, pagination.pageSize, filters);
    }, [filters, pagination.currentPage, pagination.pageSize, fetchData]);

    const handleSubmit = (values: Record<string, any>) => {
        const newFilters: Partial<QuotationQueryParams> = {
            vendor: values.vendor,
            category: values.category,
            region: values.region,
            productKeyword: values.productKeyword
        };
        setFilters(newFilters);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
    };

    const handleReset = () => {
        setFilters({});
        setPagination(prev => ({ ...prev, currentPage: 1 }));
    };

    const handlePageChange = (page: number) => {
        setPagination(prev => ({ ...prev, currentPage: page }));
    };

    const handleShowDetail = (record: QuotationRecord) => {
        setCurrentRecord(record);
        requestAnimationFrame(() => {
            setDetailVisible(true);
        });
    };

    const handleCloseDetail = () => {
        setDetailVisible(false);
        setTimeout(() => {
            setCurrentRecord(null);
        }, 300);
    };

    const columns: ColumnProps<QuotationRecord>[] = [
        {
            title: '产品名称',
            dataIndex: 'productName',
            width: 200
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
            render: (value: number) => value ? `¥${value.toFixed(2)}` : '-'
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
            render: (value: number) => value ? `${(value * 100).toFixed(0)}%` : '-'
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
            width: 150,
            ellipsis: {
                showTitle: false
            },
            render: (text: string) => (
                <span title={text}>
                    {text || '-'}
                </span>
            )
        },
        {
            title: '原件下载',
            key: 'download',
            width: 120,
            render: (_: any, record: QuotationRecord) => {
                const handleDownloadFile = async () => {
                    try {
                        Toast.info('正在准备下载...');
                        const aiServerUrl = process.env.REACT_APP_AI_SERVER_URL || 'http://localhost:3002';
                        const response = await fetch(`${aiServerUrl}/api/quotations/download/${record.id}`);
                        
                        if (!response.ok) {
                            throw new Error('下载失败');
                        }
                        
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        
                        // 从响应头获取文件名，如果没有则使用默认名称
                        const contentDisposition = response.headers.get('Content-Disposition');
                        let fileName = `${record.productName}_原始报价单`;
                        if (contentDisposition) {
                            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                            if (matches != null && matches[1]) {
                                fileName = decodeURIComponent(matches[1].replace(/['"]/g, ''));
                            }
                        }
                        
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        Toast.success('下载成功');
                    } catch (error) {
                        console.error('下载原始文件失败:', error);
                        Toast.error('下载失败，原始文件可能不存在');
                    }
                };

                return (
                    <Button
                        icon={<IconFile />}
                        theme="borderless"
                        type="primary"
                        size="small"
                        onClick={handleDownloadFile}
                    >
                        下载
                    </Button>
                );
            }
        }
    ];

    return (
        <div style={{ padding: '20px' }}>
            <Title heading={3}>历史报价查询</Title>
            
            <Form onSubmit={handleSubmit} onReset={handleReset}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <Form.Select
                        field="category"
                        label="产品类别"
                        style={{ width: 200 }}
                        placeholder="请选择"
                        showClear
                        optionList={PRODUCT_CATEGORIES.map(cat => ({
                            label: cat,
                            value: cat
                        }))}
                    />
                    <Form.Select
                        field="region"
                        label="地区"
                        style={{ width: 200 }}
                        placeholder="请选择"
                        showClear
                        optionList={REGIONS.map(region => ({
                            label: region,
                            value: region
                        }))}
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
                    <Space style={{ alignSelf: 'flex-end' }}>
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
                    onPageChange: handlePageChange
                }}
                loading={loading}
                scroll={{ x: 1500 }}
            />

            <DetailModal
                visible={detailVisible}
                onClose={handleCloseDetail}
                record={currentRecord}
            />
        </div>
    );
};

export default QuotationHistory; 