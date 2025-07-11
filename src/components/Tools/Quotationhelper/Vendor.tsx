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
import { IconHelpCircle, IconEyeOpened, IconEyeClosed, IconKey, IconDelete, IconPhone, IconMail, IconComment, IconGlobe, IconEdit, IconDownload, IconPaperclip } from '@douyinfe/semi-icons';
import * as XLSX from 'xlsx';

import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';

import { getVendorList, getVendorProducts, deleteVendor, PRODUCT_CATEGORIES, VENDOR_REGIONS } from '../../../services/vendor';
import type { VendorQueryParams, Vendor as VendorType, VendorRegion } from '../../../services/vendor';
import { useAuth } from '../../../contexts/AuthContext';
import { useVendorEdit } from '../../../contexts/VendorEditContext';
import { getVendorAttachments, getVendorAttachmentDownloadUrl } from '../../../services/vendor';

const { Title } = Typography;

// 定义筛选条件接口
interface FilterValues {
    region?: VendorRegion | VendorRegion[];
    type?: 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'DATACENTER' | 'OTHER';
    agentType?: 'GENERAL_AGENT' | 'AGENT' | 'OEM' | 'OTHER';
    productCategory?: string;
    productKeyword?: string;
    keyword?: string;
}

const Vendor: React.FC = () => {
    const { isAdmin } = useAuth();
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
    const [contactInfoVisible, setContactInfoVisible] = useState(false);
    const [currentContactInfo, setCurrentContactInfo] = useState<any>(null);
    const [currentVendorForContactInfo, setCurrentVendorForContactInfo] = useState('');
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [vendorToDelete, setVendorToDelete] = useState<VendorType | null>(null);
    const [regionsVisible, setRegionsVisible] = useState(false);
    const [currentRegions, setCurrentRegions] = useState<string[]>([]);
    // 附件相关
    const [attachmentsVisible, setAttachmentsVisible] = useState(false);
    const [currentAttachments, setCurrentAttachments] = useState<any[]>([]);
    const [currentVendorForAttachments, setCurrentVendorForAttachments] = useState('');
    const [currentVendorIdForAttachments, setCurrentVendorIdForAttachments] = useState<string>('');

    // 排序状态
    const [sorterState, setSorterState] = useState<{field:string;order:'asc'|'desc'}>({field:'englishName',order:'asc'});

    const { startEdit } = useVendorEdit();

    // 将 VendorQueryParams 转换为本地筛选类型，解决 region 数组带来的类型差异
    const convertToFilterValues = (query: VendorQueryParams): FilterValues => ({
        region: Array.isArray(query.region) ? query.region : query.region,
        type: query.type as any,
        agentType: (query as any).agentType,
        productCategory: query.productCategory,
        productKeyword: query.productKeyword,
        keyword: query.keyword
    });

    // 显示密码窗口
    const showPasswordModal = (vendor: VendorType) => {
        setCurrentPassword(vendor.password || '');
        setCurrentVendorName(vendor.name || (vendor as any).chineseName || '');
        setPasswordVisible(true);
    };

    // 显示联系人列表
    const handleShowContacts = (vendor: VendorType) => {
        setCurrentContacts(vendor.contacts || []);
        setCurrentVendorForContacts(vendor.name || (vendor as any).chineseName || '');
        setContactsVisible(true);
    };

    // 显示联系方式信息
    const handleShowContactInfo = (vendor: VendorType) => {
        // 获取主要联系人信息
        const primaryContact = vendor.contacts?.find(c => c.isPrimary) || {
            name: vendor.contact,
            phone: vendor.phone,
            email: vendor.email,
            wechat: undefined
        };
        
        setCurrentContactInfo(primaryContact);
        setCurrentVendorForContactInfo(vendor.name || (vendor as any).chineseName || '');
        setContactInfoVisible(true);
    };

    // 显示全部地区弹窗
    const handleShowRegions = (vendor: VendorType) => {
        const list = (vendor as any).regions || [(vendor as any).region];
        setCurrentRegions(list);
        setRegionsVisible(true);
    };

    // 显示附件列表
    const handleShowAttachments = async (vendor: VendorType) => {
        try {
            const list = await getVendorAttachments(vendor._id as string);
            setCurrentAttachments(list);
            setCurrentVendorForAttachments(((vendor as any).chineseName || vendor.name) as string);
            setCurrentVendorIdForAttachments(vendor._id as string);
            setAttachmentsVisible(true);
        } catch (err) {
            Toast.error('获取附件列表失败');
        }
    };

    // 显示编辑弹窗
    const handleEditVendor = (vendor: VendorType) => {
        startEdit(vendor);
    };

    // 删除供应商
    const handleDeleteVendor = async () => {
        if (!vendorToDelete || !vendorToDelete._id) return;

        try {
            await deleteVendor(vendorToDelete._id);
            Toast.success('供应商删除成功');
            setDeleteModalVisible(false);
            setVendorToDelete(null);
            // 重新加载当前页数据
            fetchSuppliers(convertToFilterValues(filters), pagination.currentPage, pagination.pageSize);
        } catch (error) {
            console.error('删除供应商失败:', error);
            Toast.error('删除供应商失败');
        }
    };

    // 获取供应商列表
    const fetchSuppliers = useCallback(async (values: FilterValues, page: number, pageSize: number, localSorter = sorterState) => {
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
                case 'OEM':
                    isGeneralAgent = false;
                    isAgent = false;
                    break;
                case 'OTHER':
                    isGeneralAgent = false;
                    isAgent = false;
                    break;
                default:
                    break;
            }

            const params: any = {
                region: values.region,
                type: values.type,
                keyword: values.keyword,
                productCategory: values.productCategory,
                productKeyword: values.productKeyword,
                agentType: values.agentType,
                isGeneralAgent,
                isAgent,
                page,
                pageSize
            };

            // 仅当显式指定排序字段时才附带后端排序参数
            if (localSorter?.field) {
                params.sortField = localSorter.field;
                params.sortOrder = localSorter.order;
            }

            const response = await getVendorList(params);

            
            // 如果有关键字，在前端进行额外过滤
            let filteredData = response.data;
            if (values.keyword) {
                const keyword = values.keyword.toLowerCase();
                filteredData = filteredData.filter(item => {
                    const chineseName = ((item as any).chineseName || item.name || '').toLowerCase();
                    const englishName = ((item as any).englishName || '').toLowerCase();
                    return chineseName.includes(keyword) ||
                    englishName.includes(keyword) ||
                    item.brands.some(brand => brand.toLowerCase().includes(keyword)) ||
                    item.contact.toLowerCase().includes(keyword)
                });
            }
            
            // 若未显式指定排序字段，前端按英文名 ASC 做兜底排序（与默认一致）
            if (!localSorter?.field) {
                filteredData.sort((a, b) => {
                    const enA = ((a as any).englishName || '').toString();
                    const enB = ((b as any).englishName || '').toString();
                    return enA.localeCompare(enB, 'en-US');
                });
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
    }, [sorterState]);

    // 初始加载数据
    useEffect(() => {
        fetchSuppliers({}, 1, 10);
    }, [fetchSuppliers]);

    // 编辑后返回列表时刷新数据
    useEffect(() => {
        if (sessionStorage.getItem('vendors_need_refresh') === 'true') {
            sessionStorage.removeItem('vendors_need_refresh');
            // 重新拉取当前页
            fetchSuppliers(convertToFilterValues(filters), pagination.currentPage, pagination.pageSize);
        }
    }, []);

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

    // 导出供应商列表（获取全部数据再导出）
    const handleExportSuppliers = async () => {
        // 如果当前总数为 0，直接提示
        if (pagination.total === 0) {
            Toast.info('暂无数据可导出');
            return;
        }

        // 重新拉取符合当前筛选条件的全部供应商
        let allSuppliers: VendorType[] = [];
        try {
            const exportParams: VendorQueryParams = {
                ...filters,
                page: 1,
                pageSize: pagination.total || 10000 // 一次性取完
            };

            const resp = await getVendorList(exportParams);
            allSuppliers = resp.data || [];
        } catch (err) {
            console.error('导出供应商时获取数据失败', err);
            Toast.error('获取供应商数据失败，无法导出');
            return;
        }

        if (allSuppliers.length === 0) {
            Toast.info('暂无数据可导出');
            return;
        }

        const data = allSuppliers.map(s => {
            // 处理代理类型文本
            let agentTypeText = '';
            if ((s as any).agentType) {
                const at = (s as any).agentType;
                if (at === 'GENERAL_AGENT') agentTypeText = '总代理';
                else if (at === 'AGENT') agentTypeText = '经销商';
                else if (at === 'OEM') agentTypeText = '原厂';
                else agentTypeText = at; // 自定义类型
            } else {
                agentTypeText = s.isGeneralAgent ? '总代理' : s.isAgent ? '经销商' : '其他';
            }

            // 基础信息
            const row: Record<string, any> = {
                供应商编码: (s as any).code || '',
                中文名称: (s as any).chineseName || s.name || '',
                英文名称: (s as any).englishName || '',
                供应商类型: s.type || '',
                代理类型: agentTypeText,
                国家地区: ((s as any).regions || [(s as any).region]).join(','),
                产品类别: Array.isArray((s as any).category) ? (s as any).category.join(',') : '',
                代理品牌: (s.brands || []).join(','),
                网站: s.website || '',
                地址: s.address || '',
                账号: s.account || '',
                录入人: (s as any).entryPerson || '',
                修改人: (s as any).modifiedBy || '',
                备注: (s as any).remarks || ''
            };

            // 如果没有 contacts 字段，使用旧的单联系人信息构造 contacts 数组
            const contacts = Array.isArray(s.contacts) && s.contacts.length > 0 ? s.contacts : [{
                name: s.contact,
                phone: s.phone,
                email: s.email,
                wechat: undefined
            }];

            // 将所有联系人信息展开
            contacts.forEach((c, idx) => {
                const no = idx + 1;
                row[`联系人${no}姓名`] = c.name || '';
                row[`联系人${no}电话`] = c.phone || '';
                row[`联系人${no}邮箱`] = c.email || '';
                row[`联系人${no}微信`] = (c as any).wechat || '';
            });

            return row;
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
        XLSX.writeFile(wb, `vendors_${Date.now()}.xlsx`);
    };

    // 表格列定义
    const columns: ColumnProps<VendorType>[] = [
        {
            title: '英文名称',
            key: 'englishName',
            dataIndex: 'englishName',
            render: (text: any, record: VendorType) => (text || '-'),
            sorter: true,
            width: 160
        },
        {
            title: '中文名称',
            key: 'chineseName',
            dataIndex: 'chineseName',
            render: (text: any, record: VendorType) => (text || record.name || '-'),
            sorter: true,
            width: 160
        },
        {
            title: '供应商类型',
            dataIndex: 'type',
            sorter: true, // 仅标记可排序，交由 onChange 远程处理
            width: 120
        },
        {
            title: '代理类型',
            key: 'agentType',
            dataIndex: 'agentType',
            render: (text: any, record: VendorType) => {
                // 优先显示新的agentType字段
                if ((record as any).agentType) {
                    const agentType = (record as any).agentType;
                    if (agentType === 'GENERAL_AGENT') return '总代理';
                    if (agentType === 'AGENT') return '经销商';
                    if (agentType === 'OEM') return '原厂';
                    return agentType; // 显示自定义代理类型
                }
                // 回退到旧的布尔字段
                if (record.isGeneralAgent) return '总代理';
                if (record.isAgent) return '经销商';
                return '其他';
            },
            sorter: true,
            width: 120
        },
        { 
            title: '地区', 
            key: 'region',
            dataIndex: 'region',
            render: (text: any, record: VendorType) => {
                const regionsArr: string[] = (record as any).regions || [record.region];
                if (regionsArr.length > 1) {
                    return (
                        <Button theme="borderless" icon={<IconGlobe />} onClick={() => handleShowRegions(record)}>
                            查看全部
                        </Button>
                    );
                }
                return regionsArr[0] || '-';
            },
            sorter: true,
            width: 120
        },
        {
            title: '联系方式',
            render: (record: VendorType) => {
                // 获取主要联系人信息
                const primaryContact = record.contacts?.find(c => c.isPrimary) || {
                    name: record.contact,
                    phone: record.phone,
                    email: record.email
                };
                
                return (
                    <Button
                        theme="borderless"
                        type="primary"
                        size="small"
                        onClick={() => handleShowContactInfo(record)}
                    >
                        {primaryContact.name}
                    </Button>
                );
            },
            width: 120
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
            title: '备注/录入/修改人',
            render: (record: VendorType) => {
                const entryPerson = (record as any).entryPerson;
                const modifiedBy = (record as any).modifiedBy;
                const remarks = record.remarks;

                if (!entryPerson && !modifiedBy && !remarks) {
                    return <span style={{ color: '#999' }}>-</span>;
                }

                return (
                    <div style={{ fontSize: '12px' }}>
                        {entryPerson && (
                            <div style={{ color: '#1890ff', marginBottom: '2px' }}>
                                录入人：{entryPerson}
                            </div>
                        )}
                        {modifiedBy && (
                            <div style={{ color: '#fa8c16', marginBottom: '2px' }}>
                                修改人：{modifiedBy}
                            </div>
                        )}
                        {remarks && (
                            <div style={{ color: '#666' }}>
                                {remarks.length > 20 ? (
                                    <Tooltip content={remarks}>
                                        <span style={{ cursor: 'pointer' }}>{remarks.substring(0, 20)}...</span>
                                    </Tooltip>
                                ) : (
                                    remarks
                                )}
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
            width: 220,
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
                    <Button
                        theme="borderless"
                        type="secondary"
                        size="small"
                        icon={<IconPaperclip />}
                        onClick={() => handleShowAttachments(record)}
                    >
                        附件
                    </Button>
                    {isAdmin && (
                        <Button
                            theme="borderless"
                            type="primary"
                            size="small"
                            icon={<IconEdit />}
                            onClick={() => handleEditVendor(record)}
                        />
                    )}
                    {isAdmin && (
                        <Button
                            theme="borderless"
                            type="danger"
                            size="small"
                            icon={<IconDelete />}
                            onClick={() => {
                                setVendorToDelete(record);
                                setDeleteModalVisible(true);
                            }}
                        />
                    )}
                </Space>
            )
        }
    ];

    // 取消自定义排序处理，使用 Table 内建排序

    /**
     * Semi UI v2.x 的 Table.onChange 仅接收一个 ChangeInfo 对象，
     *  而不是 (pagination, filters, sorter) 三个参数（Ant Design 旧签名）。
     *  这里兼容新的签名，正确提取 sorter 信息并触发后端排序。
     */
    const handleTableChange = (changeInfo: any) => {
        const { sorter, pagination: pager } = changeInfo || {};

        // 1) 检查排序是否真正发生变化
        let nextSortField = sorterState.field;
        let nextSortOrder = sorterState.order;
        let sorterChanged = false;

        if (sorter) {
            const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
            const rawOrder = singleSorter?.sortOrder || singleSorter?.order;

            if (rawOrder) {
                const candidateField = singleSorter.dataIndex || singleSorter.field || singleSorter.columnKey || singleSorter.column?.dataIndex || 'chineseName';
                const candidateOrder: 'asc' | 'desc' = rawOrder === 'ascend' ? 'asc' : 'desc';

                if (candidateField !== sorterState.field || candidateOrder !== sorterState.order) {
                    nextSortField = candidateField;
                    nextSortOrder = candidateOrder;
                    sorterChanged = true;
                    setSorterState({ field: nextSortField, order: nextSortOrder });
                    // 调试日志已移除
                }
            }
        }

        // 2) 解析分页信息
        let newPage = pager?.currentPage ?? pagination.currentPage;
        const newPageSize = pager?.pageSize ?? pagination.pageSize;

        // 如果排序发生变化，自动跳转到第一页
        if (sorterChanged) {
            newPage = 1;
        }

        // 3) 触发数据拉取
        fetchSuppliers(
            convertToFilterValues(filters),
            newPage,
            newPageSize,
            nextSortField ? { field: nextSortField, order: nextSortOrder } : undefined
        );

        // 4) 更新分页状态
        setPagination(prev => ({ ...prev, currentPage: newPage, pageSize: newPageSize }));
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Title heading={2}>供应商查询</Title>
                <Button icon={<IconDownload />} onClick={handleExportSuppliers}>
                    导出 Excel
                </Button>
            </div>
            
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
                            multiple
                            style={{ width: '100%' }}
                            placeholder="请选择"
                            showClear
                            optionList={[...VENDOR_REGIONS].map(region => ({
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
                                { label: '原厂', value: 'OEM' },
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
                onChange={handleTableChange as any}
                pagination={{
                    currentPage: pagination.currentPage,
                    pageSize: pagination.pageSize,
                    total: pagination.total
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
                                    title: '联系微信',
                                    dataIndex: 'wechat',
                                    width: 120,
                                    render: (text) => text || '-'
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

            {/* 联系方式信息模态框 */}
            <Modal
                visible={contactInfoVisible}
                title={`联系方式 - ${currentVendorForContactInfo}`}
                onCancel={() => setContactInfoVisible(false)}
                footer={null}
                width={450}
            >
                <div style={{ padding: '16px' }}>
                    {currentContactInfo ? (
                        <div style={{ lineHeight: '1.8' }}>
                            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                                <Typography.Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                                    {currentContactInfo.name}
                                </Typography.Text>
                                {currentContactInfo.position && (
                                    <div style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>
                                        {currentContactInfo.position}
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <IconPhone style={{ color: '#1890ff', fontSize: '16px' }} />
                                    <Typography.Text copyable={{ content: currentContactInfo.phone }}>
                                        {currentContactInfo.phone}
                                    </Typography.Text>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <IconMail style={{ color: '#1890ff', fontSize: '16px' }} />
                                    <Typography.Text copyable={{ content: currentContactInfo.email }}>
                                        {currentContactInfo.email}
                                    </Typography.Text>
                                </div>
                                
                                {currentContactInfo.wechat && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <IconComment style={{ color: '#1890ff', fontSize: '16px' }} />
                                        <Typography.Text copyable={{ content: currentContactInfo.wechat }}>
                                            {currentContactInfo.wechat}
                                        </Typography.Text>
                                    </div>
                                )}
                            </div>
                            
                            {currentContactInfo.remarks && (
                                <div style={{ 
                                    marginTop: '16px', 
                                    padding: '12px', 
                                    backgroundColor: 'var(--semi-color-fill-0)', 
                                    borderRadius: '6px' 
                                }}>
                                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                        备注：
                                    </Typography.Text>
                                    <div style={{ marginTop: '4px', fontSize: '14px' }}>
                                        {currentContactInfo.remarks}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--semi-color-text-2)' }}>
                            暂无联系方式信息
                        </div>
                    )}
                </div>
            </Modal>

            {/* 删除供应商确认弹窗 */}
            <Modal
                title="删除供应商"
                visible={deleteModalVisible}
                onCancel={() => {
                    setDeleteModalVisible(false);
                    setVendorToDelete(null);
                }}
                onOk={handleDeleteVendor}
                okText="确认删除"
                cancelText="取消"
                type="warning"
            >
                <p>确定要删除供应商 <strong>{vendorToDelete?.name}</strong> 吗？</p>
                <p style={{ color: 'var(--semi-color-warning)', fontSize: '14px' }}>
                    此操作不可撤销，删除后将无法恢复该供应商的所有信息。
                </p>
            </Modal>

            {/* 地区列表弹窗 */}
            <Modal
                visible={regionsVisible}
                title="供应商所在地区"
                onCancel={() => setRegionsVisible(false)}
                footer={null}
            >
                <div style={{ padding: 16 }}>
                    <Space wrap>
                        {currentRegions.map((r, idx) => (
                            <Tag key={idx} color="green" type="light">{r}</Tag>
                        ))}
                    </Space>
                </div>
            </Modal>

            {/* 附件列表弹窗 */}
            <Modal
                visible={attachmentsVisible}
                title={`附件列表 - ${currentVendorForAttachments}`}
                onCancel={() => setAttachmentsVisible(false)}
                footer={null}
                width={800}
            >
                <div style={{ padding: 16, maxHeight: '60vh', overflowY: 'auto' }}>
                    {currentAttachments.length > 0 ? (
                        <Table
                            dataSource={currentAttachments}
                            pagination={false}
                            size="small"
                            columns={[
                                { title: '文件名', dataIndex: 'originalName' },
                                { title: '大小(KB)', dataIndex: 'size', render: (s:any)=> (s/1024).toFixed(1) },
                                { title: '上传时间', dataIndex: 'uploadedAt', render: (t:any)=> new Date(t).toLocaleString() },
                                {
                                    title: '操作',
                                    render: (text: any, record: any) => (
                                        <a href={getVendorAttachmentDownloadUrl(currentVendorIdForAttachments, record.filename)} target="_blank" rel="noopener noreferrer">下载</a>
                                    )
                                }
                            ]}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--semi-color-text-2)' }}>暂无附件</div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Vendor; 
