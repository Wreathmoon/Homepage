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

const { Title, Text } = Typography;

// 货币符号映射函数
const getCurrencySymbol = (currency: string): string => {
    const currencySymbols: { [key: string]: string } = {
        'CNY': '¥',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'HKD': 'HK$',
        'AUD': 'A$',
        'CAD': 'C$',
        'SGD': 'S$',
        'CHF': 'CHF',
        'SEK': 'kr',
        'NOK': 'kr',
        'DKK': 'kr',
        'INR': '₹',
        'KRW': '₩',
        'THB': '฿',
        'MYR': 'RM',
        'TWD': 'NT$',
        'VND': '₫',
        'IDR': 'Rp',
        'BRL': 'R$',
        'ZAR': 'R',
        'MXN': '$',
        'NZD': 'NZ$',
        'PLN': 'zł',
        'HUF': 'Ft',
        'CZK': 'Kč',
        'TRY': '₺',
        'SAR': '﷼',
        'AED': 'د.إ',
        'ILS': '₪'
    };
    return currencySymbols[currency] || currency;
};

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
            
            // 获取正确的ID字段
            const quotationId = record._id || record.id;
            if (!quotationId) {
                Toast.error('无法获取报价记录ID');
                return;
            }
            
            const apiServerUrl = process.env.REACT_APP_API_SERVER_URL || 'http://localhost:3001';
            const downloadUrl = `${apiServerUrl}/api/quotations/download/${quotationId}`;
            console.log('📥 下载URL:', downloadUrl);
            
            const response = await fetch(downloadUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('下载失败:', response.status, errorText);
                
                let errorMessage = '下载失败';
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.reason === 'missing_original_file') {
                        errorMessage = '该记录没有关联的原始文件（可能是手动添加的记录）';
                    } else if (errorData.reason === 'empty_file_path') {
                        errorMessage = '文件路径信息丢失，无法下载原始文件';
                    } else {
                        errorMessage = errorData.error || errorMessage;
                    }
                } catch {
                    // 解析失败，使用默认错误信息
                }
                
                throw new Error(errorMessage);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // 从响应头获取文件名，如果没有则使用默认名称
            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = `${record.productName}_原始报价单`;
            
            if (contentDisposition) {
                console.log('📋 Content-Disposition:', contentDisposition);
                
                // 支持新的 filename*=UTF-8'' 格式
                const utf8Match = /filename\*=UTF-8''([^;]+)/.exec(contentDisposition);
                if (utf8Match) {
                    fileName = decodeURIComponent(utf8Match[1]);
                } else {
                    // 回退到旧的 filename= 格式
                    const regularMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                    if (regularMatch && regularMatch[1]) {
                        fileName = decodeURIComponent(regularMatch[1].replace(/['"]/g, ''));
                    }
                }
                
                console.log('📁 解析的文件名:', fileName);
            } else {
                // 如果没有Content-Disposition头，尝试从记录中获取更好的文件名
                if (record.originalFile?.originalName) {
                    fileName = record.originalFile.originalName;
                } else {
                    // 根据文件扩展名生成合适的文件名
                    const contentType = response.headers.get('Content-Type');
                    let extension = '';
                    
                    if (contentType) {
                        const typeMap: Record<string, string> = {
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                            'application/vnd.ms-excel': 'xls',
                            'application/pdf': 'pdf',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                            'application/msword': 'doc',
                            'text/csv': 'csv',
                            'text/plain': 'txt'
                        };
                        extension = typeMap[contentType] || '';
                    }
                    
                    fileName = extension ? `${record.productName}_原始报价单.${extension}` : `${record.productName}_原始报价单`;
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('404')) {
                Toast.error('原始文件不存在或已被删除');
            } else if (errorMessage.includes('500')) {
                Toast.error('服务器内部错误，请联系管理员');
            } else {
                Toast.error('下载失败：' + errorMessage);
            }
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
                    {/* 价格信息区域 */}
                    <div style={{ marginBottom: '20px' }}>
                        <Title heading={5} style={{ marginBottom: '12px' }}>价格信息</Title>
                        <Descriptions
                            data={[
                                {
                                    key: 'List Price',
                                    value: record.originalPrice || record.totalPrice ? 
                                        `${getCurrencySymbol(record.currency || 'EUR')}${(record.originalPrice || record.totalPrice || 0).toLocaleString()}` : 
                                        '-'
                                },
                                {
                                    key: '折扣后总价',
                                    value: record.finalPrice || record.discountedTotalPrice ? 
                                        `${getCurrencySymbol(record.currency || 'EUR')}${(record.finalPrice || record.discountedTotalPrice || 0).toLocaleString()}` : 
                                        '-'
                                },
                                {
                                    key: '单价',
                                    value: (() => {
                                        // 优先显示unitPrice
                                        if ((record as any).unitPrice) {
                                            return `${getCurrencySymbol(record.currency || 'EUR')}${(record as any).unitPrice.toLocaleString()}`;
                                        }
                                        // 尝试从总价和数量计算单价
                                        const totalPrice = record.finalPrice || record.quote_unit_price;
                                        const quantity = record.quantity || 1;
                                        if (totalPrice && quantity > 0) {
                                            const calculatedUnitPrice = totalPrice / quantity;
                                            return `${getCurrencySymbol(record.currency || 'EUR')}${calculatedUnitPrice.toLocaleString()}`;
                                        }
                                        return '-';
                                    })()
                                },
                                {
                                    key: '数量',
                                    value: record.quantity || 1
                                },
                                {
                                    key: '折扣率',
                                    value: record.discount || record.discount_rate ? 
                                        `${((record.discount || record.discount_rate || 0) * 100).toFixed(1)}%` : 
                                        '-'
                                },
                                {
                                    key: '币种',
                                    value: `${record.currency || 'EUR'} (${getCurrencySymbol(record.currency || 'EUR')})`
                                },
                                {
                                    key: '供应商',
                                    value: record.vendor || record.supplier || '-'
                                },
                                {
                                    key: '报价日期',
                                    value: record.quotationDate || (record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '-')
                                }
                            ]}
                            row
                            size="small"
                        />
                    </div>

                    {/* 详细配置信息 */}
                    <div>
                        <Title heading={5} style={{ marginBottom: '12px' }}>详细配置信息</Title>
                        <div style={{
                            fontSize: '14px',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            background: 'var(--semi-color-fill-0)',
                            padding: '16px',
                            borderRadius: '4px',
                            maxHeight: '40vh',
                            overflow: 'auto'
                        }}>
                            {(() => {
                                const content = record.configDetail || record.productSpec || record.detailedComponents || '暂无详细配置信息';
                                if (content === '暂无详细配置信息') {
                                    return content;
                                }
                                // 🔥 关键修复：处理转义的换行符，确保正确显示
                                return content
                                    .replace(/\\n/g, '\n')  // 将\n转换为实际换行
                                    .replace(/\\r/g, '\r')  // 处理\r
                                    .replace(/\\t/g, '\t')  // 处理\t
                                    .replace(/- /g, '\n- ') // 确保每个-项目都在新行
                                    .replace(/,\s*/g, ',\n')
                                    .replace(/;\s*/g, ';\n')
                                    .replace(/\|\s*/g, '|\n')
                                    .replace(/，\s*/g, '，\n')
                                    .replace(/；\s*/g, '；\n')
                                    .replace(/\n\s*\n/g, '\n')
                                    .trim();
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const QuotationHistory: React.FC = () => {
    const [data, setData] = useState<QuotationRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        pageSize: 10,
        total: 0
    });
    const [filters, setFilters] = useState<Partial<QuotationQueryParams>>({});
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<QuotationRecord | null>(null);
    
    // 添加备注弹窗状态
    const [remarkModalVisible, setRemarkModalVisible] = useState(false);
    const [currentRemark, setCurrentRemark] = useState<string>('');
    const [currentProductName, setCurrentProductName] = useState<string>('');

    const fetchData = useCallback(async (page: number, pageSize: number, searchFilters: Partial<QuotationQueryParams>) => {
        setLoading(true);
        try {
            const params: QuotationQueryParams = {
                page,
                pageSize,
                ...searchFilters
            };
            
            const response = await getQuotationList(params);
            setData(response.data);
            setPagination(prev => ({
                ...prev,
                total: response.total
            }));
        } catch (error) {
            console.error('获取数据失败:', error);
            Toast.error('获取数据失败');
        } finally {
            setLoading(false);
        }
    }, []);

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

    // 添加备注弹窗处理函数
    const handleShowRemark = (record: QuotationRecord) => {
        setCurrentRemark(record.remark || record.notes || '');
        setCurrentProductName(record.productName);
        setRemarkModalVisible(true);
    };

    const handleCloseRemark = () => {
        setRemarkModalVisible(false);
        setTimeout(() => {
            setCurrentRemark('');
            setCurrentProductName('');
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
            title: 'List Price',
            dataIndex: 'originalPrice',
            width: 120,
            render: (value: number, record: QuotationRecord) => value ? `${getCurrencySymbol(record.currency || 'EUR')}${value.toLocaleString()}` : '-'
        },
        {
            title: '折扣后总价',
            dataIndex: 'finalPrice',
            width: 120,
            render: (value: number, record: QuotationRecord) => `${getCurrencySymbol(record.currency || 'EUR')}${value.toLocaleString()}`
        },
        {
            title: '单价',
            dataIndex: 'unitPrice',
            width: 120,
            render: (value: number, record: QuotationRecord) => {
                // 优先显示unitPrice，如果没有则尝试计算
                if (value) {
                    return `${getCurrencySymbol(record.currency || 'EUR')}${value.toLocaleString()}`;
                }
                // 尝试从总价和数量计算单价
                const totalPrice = record.finalPrice || record.quote_unit_price;
                const quantity = record.quantity || 1;
                if (totalPrice && quantity > 0) {
                    const calculatedUnitPrice = totalPrice / quantity;
                    return `${getCurrencySymbol(record.currency || 'EUR')}${calculatedUnitPrice.toLocaleString()}`;
                }
                return '-';
            }
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
            render: (text: string, record: QuotationRecord) => {
                const remarkText = text || record.notes || '';
                if (!remarkText) {
                    return <span style={{ color: 'var(--semi-color-text-2)' }}>无备注</span>;
                }
                return (
                    <Button
                        theme="borderless"
                        type="primary"
                        size="small"
                        onClick={() => handleShowRemark(record)}
                        style={{ padding: '4px 8px' }}
                    >
                        查看备注
                    </Button>
                );
            }
        },
        {
            title: '原件下载',
            key: 'download',
            width: 120,
            render: (_: any, record: QuotationRecord) => {
                const handleDownloadFile = async () => {
                    try {
                        Toast.info('正在准备下载...');
                        
                        // 获取正确的ID字段
                        const quotationId = record._id || record.id;
                        if (!quotationId) {
                            Toast.error('无法获取报价记录ID');
                            return;
                        }
                        
                        const aiServerUrl = process.env.REACT_APP_AI_SERVER_URL || 'http://localhost:3002';
                        const downloadUrl = `${aiServerUrl}/api/quotations/download/${quotationId}`;
                        console.log('📥 表格下载URL:', downloadUrl);
                        
                        const response = await fetch(downloadUrl);
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('下载失败:', response.status, errorText);
                            
                            let errorMessage = '下载失败';
                            try {
                                const errorData = JSON.parse(errorText);
                                if (errorData.reason === 'missing_original_file') {
                                    errorMessage = '该记录没有关联的原始文件（可能是手动添加的记录）';
                                } else if (errorData.reason === 'empty_file_path') {
                                    errorMessage = '文件路径信息丢失，无法下载原始文件';
                                } else {
                                    errorMessage = errorData.error || errorMessage;
                                }
                            } catch {
                                // 解析失败，使用默认错误信息
                            }
                            
                            throw new Error(errorMessage);
                        }
                        
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        
                        // 从响应头获取文件名，如果没有则使用默认名称
                        const contentDisposition = response.headers.get('Content-Disposition');
                        let fileName = `${record.productName}_原始报价单`;
                        
                        if (contentDisposition) {
                            console.log('📋 Content-Disposition:', contentDisposition);
                            
                            // 支持新的 filename*=UTF-8'' 格式
                            const utf8Match = /filename\*=UTF-8''([^;]+)/.exec(contentDisposition);
                            if (utf8Match) {
                                fileName = decodeURIComponent(utf8Match[1]);
                            } else {
                                // 回退到旧的 filename= 格式
                                const regularMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                                if (regularMatch && regularMatch[1]) {
                                    fileName = decodeURIComponent(regularMatch[1].replace(/['"]/g, ''));
                                }
                            }
                            
                            console.log('📁 解析的文件名:', fileName);
                        } else {
                            // 如果没有Content-Disposition头，尝试从记录中获取更好的文件名
                            if (record.originalFile?.originalName) {
                                fileName = record.originalFile.originalName;
                            } else {
                                // 根据文件扩展名生成合适的文件名
                                const contentType = response.headers.get('Content-Type');
                                let extension = '';
                                
                                if (contentType) {
                                    const typeMap: Record<string, string> = {
                                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                                        'application/vnd.ms-excel': 'xls',
                                        'application/pdf': 'pdf',
                                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                                        'application/msword': 'doc',
                                        'text/csv': 'csv',
                                        'text/plain': 'txt'
                                    };
                                    extension = typeMap[contentType] || '';
                                }
                                
                                fileName = extension ? `${record.productName}_原始报价单.${extension}` : `${record.productName}_原始报价单`;
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
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        if (errorMessage.includes('404')) {
                            Toast.error('原始文件不存在或已被删除');
                        } else if (errorMessage.includes('500')) {
                            Toast.error('服务器内部错误，请联系管理员');
                        } else {
                            Toast.error('下载失败：' + errorMessage);
                        }
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
                dataSource={data}
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
            
            {/* 备注弹窗 */}
            <Modal
                title={`备注信息 - ${currentProductName}`}
                visible={remarkModalVisible}
                onCancel={handleCloseRemark}
                footer={
                    <Button type="primary" onClick={handleCloseRemark}>
                        关闭
                    </Button>
                }
                width={600}
                style={{ top: '20vh' }}
            >
                <div style={{ 
                    maxHeight: '400px', 
                    overflow: 'auto',
                    padding: '16px',
                    background: 'var(--semi-color-fill-0)',
                    borderRadius: '8px',
                    border: '1px solid var(--semi-color-border)'
                }}>
                    {currentRemark ? (
                        <Text style={{ 
                            whiteSpace: 'pre-wrap', 
                            lineHeight: '1.6',
                            fontSize: '14px'
                        }}>
                            {(() => {
                                // 🔥 关键修复：处理转义的换行符，确保正确显示
                                return currentRemark
                                    .replace(/\\n/g, '\n')  // 将\n转换为实际换行
                                    .replace(/\\r/g, '\r')  // 处理\r
                                    .replace(/\\t/g, '\t')  // 处理\t
                                    .replace(/- /g, '\n- ') // 确保每个-项目都在新行
                                    .replace(/,\s*/g, ',\n')
                                    .replace(/;\s*/g, ';\n')
                                    .replace(/\|\s*/g, '|\n')
                                    .replace(/，\s*/g, '，\n')
                                    .replace(/；\s*/g, '；\n')
                                    .replace(/\n\s*\n/g, '\n')
                                    .trim();
                            })()}
                        </Text>
                    ) : (
                        <Text type="secondary" style={{ fontStyle: 'italic' }}>
                            暂无备注信息
                        </Text>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default QuotationHistory; 