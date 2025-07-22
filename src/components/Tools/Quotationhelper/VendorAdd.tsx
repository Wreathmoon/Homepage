import React, { useState, useRef, useEffect } from 'react';
import { 
    Typography, 
    Form, 
    Button, 
    Card,
    Space,
    Toast,
    TagInput,
    Switch,
    Divider,
    Modal,
    Input,
    DatePicker,
    Table,
    Popconfirm,
    Tag,
    Upload
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconEdit } from '@douyinfe/semi-icons';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { PRODUCT_CATEGORIES, REGIONS } from '../../../services/quotationHistory';
import { API_CONFIG } from '../../../utils/config';
import type { ContactInfo } from '../../../services/vendor';
import { useAuth } from '../../../contexts/AuthContext';
import { useVendorEdit } from '../../../contexts/VendorEditContext';
import { uploadVendorAttachments } from '../../../services/vendor';

const { Title, Text } = Typography;

// 定义供应商信息表单数据接口
interface VendorFormData {
    chineseName: string;
    englishName?: string;
    // 向后兼容旧字段
    name?: string;

    code?: string;
    category: string[];

    // 多地区数组
    regions: string[];
    // 向后兼容单地区
    region?: string;
    // 主要联系人信息（保持向后兼容）
    contact: string;
    phone: string;
    email: string;
    address?: string;
    status: 'active' | 'inactive';
    remarks?: string;
    type: 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'DATACENTER' | 'OTHER';
    website?: string;
    brands?: string;
    // 报障方式
    reportMethod?: string;
    agentType: 'GENERAL_AGENT' | 'AGENT' | 'OEM' | 'CARRIER' | 'OTHER';
    account?: string;
    password?: string;
    entryPerson: string;
    entryTime: string;
}

// 联系人表单数据接口
interface ContactFormData {
    name: string;
    phone: string;
    email: string;
    wechat?: string;
    position?: string;
    remarks?: string;
    isPrimary?: boolean;
}

// 供应商类型选项
const VENDOR_TYPES = [
    { label: '硬件供应商', value: 'HARDWARE' },
    { label: '软件供应商', value: 'SOFTWARE' },
    { label: '服务供应商', value: 'SERVICE' },
    { label: '数据中心', value: 'DATACENTER' },
    { label: '添加其他', value: 'ADD_OTHER_TYPE' }
];

// 代理资质选项
const AGENT_TYPE_OPTIONS = [
    { label: '总代理', value: 'GENERAL_AGENT' },
    { label: '经销商', value: 'AGENT' },
    { label: '原厂', value: 'OEM' },
    { label: '运营商', value: 'CARRIER' },
    { label: '添加其他', value: 'ADD_OTHER_AGENT' }
];

// 状态选项
const STATUS_OPTIONS = [
    { label: '激活', value: 'active' },
    { label: '禁用', value: 'inactive' }
];

const VendorAdd: React.FC = () => {
    const { currentUser, isAdmin, currentUserInfo } = useAuth(); // 获取当前登录用户和角色
    const { editVendor, clearEdit, goToVendorList } = useVendorEdit();
    const [loading, setLoading] = useState(false);
    const [savedVendors, setSavedVendors] = useState<any[]>([]);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    // 附件文件列表
    const [attachments, setAttachments] = useState<File[]>([]);
    
    // 联系人相关状态
    const [contacts, setContacts] = useState<ContactInfo[]>(editVendor?.contacts || []);
    const [contactModalVisible, setContactModalVisible] = useState(false);
    const [editingContact, setEditingContact] = useState<ContactInfo | null>(null);
    const [editingIndex, setEditingIndex] = useState<number>(-1);
    
    // 自定义产品类别相关状态
    const [customCategoryModalVisible, setCustomCategoryModalVisible] = useState(false);
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [currentCustomCategory, setCurrentCustomCategory] = useState('');
    
    // 自定义供应商类型相关状态
    const [customTypeModalVisible, setCustomTypeModalVisible] = useState(false);
    const [customTypes, setCustomTypes] = useState<string[]>([]);
    const [currentCustomType, setCurrentCustomType] = useState('');
    
    // 自定义代理资质相关状态
    const [customAgentModalVisible, setCustomAgentModalVisible] = useState(false);
    const [customAgentTypes, setCustomAgentTypes] = useState<string[]>([]);
    const [currentCustomAgentType, setCurrentCustomAgentType] = useState('');
    
    // 自定义地区相关状态
    const [customRegionModalVisible, setCustomRegionModalVisible] = useState(false);
    const [customRegions, setCustomRegions] = useState<string[]>([]);
    const [currentCustomRegion, setCurrentCustomRegion] = useState('');
    
    const formRef = useRef<FormApi<VendorFormData>>();
    const contactFormRef = useRef<FormApi<ContactFormData>>();

    // 自动生成供应商代码
    const generateVendorCode = (enName?: string, cnName?: string) => {
        const base = enName || cnName || 'VND';
        const timestamp = Date.now().toString().slice(-4);
        return `${base.substring(0, 3).toUpperCase()}_${timestamp}`;
    };

    // 获取完整的产品类别列表（预设+自定义）
    const getAllProductCategories = () => {
        // 将"其他"替换为"添加其他"，并添加自定义类别
        const baseCategories = PRODUCT_CATEGORIES.map(cat => 
            cat === '其他' ? '添加其他' : cat
        );
        return [...baseCategories, ...customCategories];
    };

    // 获取完整的供应商类型列表（预设+自定义）
    const getAllVendorTypes = () => {
        return [...VENDOR_TYPES, ...customTypes.map(type => ({ label: type, value: type }))];
    };

    // 获取完整的代理资质列表（预设+自定义）
    const getAllAgentTypes = () => {
        return [...AGENT_TYPE_OPTIONS, ...customAgentTypes.map(type => ({ label: type, value: type }))];
    };

    // 获取完整的地区列表（预设+自定义）
    const getAllRegions = () => {
        const baseRegions = REGIONS.map(region => 
            region === '其他' ? '添加其他' : region
        );
        return [...baseRegions, ...customRegions];
    };

    // 处理产品类别选择变化
    const handleCategoryChange = (value: string | number | any[] | Record<string, any>) => {
        const values = Array.isArray(value) ? value as string[] : [];
        
        if (values.includes('添加其他')) {
            // 如果选择了"添加其他"，打开自定义输入弹窗
            setCustomCategoryModalVisible(true);
        }
        
        // 检查是否有自定义类别被删除
        const currentValues = formRef.current?.getValue('category') || [];
        const removedCustomCategories = customCategories.filter(
            customCat => currentValues.includes(customCat) && !values.includes(customCat)
        );
        
        // 从自定义类别列表中删除被移除的类别
        if (removedCustomCategories.length > 0) {
            setCustomCategories(prev => 
                prev.filter(cat => !removedCustomCategories.includes(cat))
            );
        }
        
        // 更新表单值
        formRef.current?.setValue('category', values);
    };

    // 保存自定义产品类别
    const handleSaveCustomCategory = () => {
        if (!currentCustomCategory.trim()) {
            Toast.error('请输入产品类别名称');
            return;
        }

        const trimmedCategory = currentCustomCategory.trim();
        
        // 检查是否已存在
        const allCategories = getAllProductCategories();
        if (allCategories.includes(trimmedCategory)) {
            Toast.error('该产品类别已存在');
            return;
        }

        // 添加到自定义类别列表
        setCustomCategories(prev => [...prev, trimmedCategory]);
        
        // 更新表单中的选择值
        const currentValues = formRef.current?.getValue('category') || [];
        const newValues = currentValues.filter(val => val !== '添加其他'); // 移除"添加其他"
        newValues.push(trimmedCategory); // 添加自定义类别
        formRef.current?.setValue('category', newValues);

        // 重置和关闭弹窗
        setCurrentCustomCategory('');
        setCustomCategoryModalVisible(false);
        Toast.success('自定义产品类别添加成功');
    };

    // 处理供应商类型选择
    const handleVendorTypeChange = (value: string | number | any[] | Record<string, any>) => {
        const stringValue = String(value);
        if (stringValue === 'ADD_OTHER_TYPE') {
            setCustomTypeModalVisible(true);
        } else {
            formRef.current?.setValue('type', stringValue);
        }
    };

    // 保存自定义供应商类型
    const handleSaveCustomVendorType = () => {
        if (!currentCustomType.trim()) {
            Toast.error('请输入供应商类型名称');
            return;
        }

        const trimmedType = currentCustomType.trim();
        
        // 检查是否已存在
        const allTypes = getAllVendorTypes();
        if (allTypes.some(type => type.label === trimmedType || type.value === trimmedType)) {
            Toast.error('该供应商类型已存在');
            return;
        }

        // 添加到自定义类型列表
        setCustomTypes(prev => [...prev, trimmedType]);
        
        // 更新表单中的选择值
        formRef.current?.setValue('type', trimmedType);

        // 重置和关闭弹窗
        setCurrentCustomType('');
        setCustomTypeModalVisible(false);
        Toast.success('自定义供应商类型添加成功');
    };

    // 处理代理资质选择
    const handleAgentQualificationChange = (value: string | number | any[] | Record<string, any>) => {
        const stringValue = String(value);
        if (stringValue === 'ADD_OTHER_AGENT') {
            setCustomAgentModalVisible(true);
        } else {
            formRef.current?.setValue('agentType', stringValue);
        }
    };

    // 保存自定义代理资质
    const handleSaveCustomAgent = () => {
        if (!currentCustomAgentType.trim()) {
            Toast.error('请输入代理资质名称');
            return;
        }

        const trimmedAgentType = currentCustomAgentType.trim();
        
        // 检查是否已存在
        const allAgentTypes = getAllAgentTypes();
        if (allAgentTypes.some(type => type.label === trimmedAgentType || type.value === trimmedAgentType)) {
            Toast.error('该代理资质已存在');
            return;
        }

        // 添加到自定义代理资质列表
        setCustomAgentTypes(prev => [...prev, trimmedAgentType]);
        
        // 更新表单中的选择值
        formRef.current?.setValue('agentType', trimmedAgentType);

        // 重置和关闭弹窗
        setCurrentCustomAgentType('');
        setCustomAgentModalVisible(false);
        Toast.success('自定义代理资质添加成功');
    };

    // 处理多地区选择
    const handleRegionsChange = (value: string | number | any[] | Record<string, any>) => {
        const values = Array.isArray(value) ? value as string[] : [];
        if (values.includes('添加其他')) {
            setCustomRegionModalVisible(true);
        }
        formRef.current?.setValue('regions', values);
    };

    // 保存自定义地区
    const handleSaveCustomLocation = () => {
        if (!currentCustomRegion.trim()) {
            Toast.error('请输入地区名称');
            return;
        }

        const trimmedRegion = currentCustomRegion.trim();
        
        // 检查是否已存在
        const allRegions = getAllRegions();
        if (allRegions.includes(trimmedRegion)) {
            Toast.error('该地区已存在');
            return;
        }

        // 添加到自定义地区列表
        setCustomRegions(prev => [...prev, trimmedRegion]);
        
        // 更新表单中的选择值
        formRef.current?.setValue('regions', trimmedRegion);

        // 重置和关闭弹窗
        setCurrentCustomRegion('');
        setCustomRegionModalVisible(false);
        Toast.success('自定义地区添加成功');
    };

    // 联系人表格列定义
    const contactColumns: ColumnProps<ContactInfo>[] = [
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
                <span style={{ color: isPrimary ? '#1890ff' : '#999' }}>
                    {isPrimary ? '是' : '否'}
                </span>
            )
        },
        {
            title: '备注',
            dataIndex: 'remarks',
            width: 150,
            render: (text) => {
                if (!text) return '-';
                return text.length > 20 ? text.substring(0, 20) + '...' : text;
            }
        },
        {
            title: '操作',
            fixed: 'right' as const,
            width: 120,
            render: (_, record, index) => (
                <Space>
                    <Button
                        theme="borderless"
                        type="primary"
                        size="small"
                        icon={<IconEdit />}
                        onClick={() => handleEditContact(record, index)}
                    />
                    <Popconfirm
                        title="确定删除这个联系人吗？"
                        onConfirm={() => handleDeleteContact(index)}
                    >
                        <Button
                            theme="borderless"
                            type="danger"
                            size="small"
                            icon={<IconDelete />}
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // 添加联系人
    const handleAddContact = () => {
        setEditingContact(null);
        setEditingIndex(-1);
        setContactModalVisible(true);
    };

    // 编辑联系人
    const handleEditContact = (contact: ContactInfo, index: number) => {
        setEditingContact(contact);
        setEditingIndex(index);
        setContactModalVisible(true);
    };

    // 删除联系人
    const handleDeleteContact = (index: number) => {
        const newContacts = contacts.filter((_, i) => i !== index);
        setContacts(newContacts);
        Toast.success('联系人删除成功');
    };

    // 保存联系人
    const handleSaveContact = (values: ContactFormData) => {
        // 如果设置为主要联系人，需要取消其他联系人的主要状态
        let newContacts = [...contacts];
        if (values.isPrimary) {
            newContacts = newContacts.map(contact => ({ ...contact, isPrimary: false }));
        }

        if (editingIndex >= 0) {
            // 编辑现有联系人
            newContacts[editingIndex] = values;
            Toast.success('联系人更新成功');
        } else {
            // 添加新联系人
            newContacts.push(values);
            Toast.success('联系人添加成功');
        }

        setContacts(newContacts);
        setContactModalVisible(false);
        contactFormRef.current?.reset();
    };

    // 处理密码设置
    const handlePasswordSave = () => {
        formRef.current?.setValue('password', currentPassword);
        setPasswordVisible(false);
    };

    // 提交表单
    const handleSubmit = async (values: VendorFormData) => {
        // 检查是否有联系人
        if (contacts.length === 0) {
            Toast.error('请至少添加一个联系人');
            return;
        }

        // 检查是否有主要联系人
        const primaryContact = contacts.find(c => c.isPrimary);
        if (!primaryContact) {
            Toast.error('请设置一个主要联系人');
            return;
        }

        setLoading(true);
        try {
            console.log('🔄 提交供应商信息:', values);
            
            const submitData: any = {
                ...values,
                contacts: contacts,
            };
            // 若中文名为空，用英文名补充
            if (!values.chineseName && values.englishName) {
                submitData.chineseName = values.englishName;
            }
            // 向后兼容旧字段 name
            submitData.name = submitData.chineseName || values.chineseName || values.englishName;

            // 处理地区映射
            if (values.regions && values.regions.length > 0) {
                submitData.region = values.regions[0];
            }
            
            // 多个联系人信息
            submitData.contacts = contacts;
            // 主要联系人信息（向后兼容）
            submitData.contact = primaryContact.name;
            submitData.phone = primaryContact.phone;
            submitData.email = primaryContact.email;
            // 确保必填字段有默认值
            submitData.type = values.type || 'HARDWARE';
            submitData.status = values.status || 'active';
            submitData.category = (values.category || []).filter((cat: string) => cat !== '添加其他');
            if (values.brands) {
                submitData.brands = values.brands.split(/[,，]/).map((b: string)=>b.trim()).filter((b:string)=>b);
            } else if (editVendor) {
                submitData.brands = editVendor.brands;
            } else {
                submitData.brands = [];
            }
            submitData.password = currentPassword || '';
            // 将agentType转换为后端期望的布尔字段，同时保留agentType本身
            submitData.isGeneralAgent = values.agentType === 'GENERAL_AGENT';
            submitData.isAgent = values.agentType === 'AGENT';
            submitData.agentType = values.agentType;
            // 添加其他字段
            submitData.website = values.website || '';
            submitData.remarks = values.remarks || '';
            submitData.account = values.account || '';
            submitData.address = values.address || '';
            submitData.reportMethod = values.reportMethod || '';

            // 处理 code
            if (editVendor) {
                const origCode = editVendor.code || (sessionStorage.getItem('edit_vendor') ? JSON.parse(sessionStorage.getItem('edit_vendor') as string).code : undefined);
                if (origCode) submitData.code = origCode;
            } else {
                // 新增时生成code
                submitData.code = generateVendorCode(values.englishName, values.chineseName);
            }

            if (editVendor) {
                // 更新操作：保留原录入人，记录最后修改人
                submitData.modifiedBy = currentUser || '未知用户';
            } else {
                // 新增操作：记录录入人和录入时间
                submitData.entryPerson = (currentUserInfo as any)?.username || currentUser || '未知用户';
                submitData.entryTime = values.entryTime || new Date().toISOString().split('T')[0];
            }
            
            // 移除 undefined 字段
            Object.keys(submitData).forEach(key => {
                if ((submitData as any)[key] === undefined) {
                    delete (submitData as any)[key];
                }
            });
            
            console.log('🔄 处理后的数据:', submitData);
            
            const apiServerUrl = API_CONFIG.API_URL;
            const editId = editVendor?._id || sessionStorage.getItem('edit_vendor_id');
            const isEdit = Boolean(editId);

            let url: string;
            let method: 'POST' | 'PUT';
            if (isEdit) {
                // 管理员使用全局接口，普通用户使用自编辑接口
                if (isAdmin) {
                    url = `${apiServerUrl}/api/vendors/${editId}`;
                } else if (currentUserInfo?.vendorEditable?.enabled && currentUserInfo.vendorEditable.expiresAt && new Date(currentUserInfo.vendorEditable.expiresAt as string | number | Date) > new Date()) {
                    url = `${apiServerUrl}/api/vendors/${editId}`;
                } else {
                    url = `${apiServerUrl}/api/vendors/${editId}/self`;
                }
                method = 'PUT';
            } else {
                url = `${apiServerUrl}/api/vendors`;
                method = 'POST';
            }

            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-user': encodeURIComponent(localStorage.getItem('user_username') || ''),
                    'x-user-role': isAdmin ? 'admin' : 'user',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(submitData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('保存失败:', response.status, errorText);
                throw new Error(`保存失败: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ 供应商保存成功:', result);
            
            if (result.success) {
                // 若有附件，上传
                if (attachments.length > 0) {
                    const vid = isEdit ? (editId as string) : result.data._id;
                    try {
                        await uploadVendorAttachments(vid, attachments);
                    } catch (err) {
                        console.error('附件上传失败', err);
                        Toast.warning('供应商保存成功，但附件上传失败');
                    }
                }

                // 清理附件
                setAttachments([]);
                Toast.success(result.message || (editVendor ? '供应商信息更新成功' : '供应商信息保存成功'));
                setSavedVendors(prev => [...prev, result.data]);
                
                // 重置表单和联系人
                formRef.current?.reset();
                setContacts([]);
                setCurrentPassword('');
                setCustomCategories([]); // 重置自定义类别
                if (editVendor) {
                    sessionStorage.setItem('vendors_need_refresh', 'true');
                    sessionStorage.removeItem('edit_vendor_id');
                    clearEdit();
                    goToVendorList();
                    return; // 结束
                }
                
                // 重置后重新设置录入人字段
                setTimeout(() => {
                    formRef.current?.setValue('entryPerson', currentUser || '');
                }, 100);
            } else {
                throw new Error(result.message || '保存失败');
            }
            
        } catch (error) {
            console.error('❌ 供应商保存失败:', error);
            
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                Toast.error('无法连接到API服务器，请确保服务器正在运行 (端口3001)');
            } else if (error instanceof Error && error.message.includes('ERR_CONNECTION_REFUSED')) {
                Toast.error('连接被拒绝，请检查API服务器状态');
            } else {
                Toast.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // 重置表单
    const handleReset = () => {
        formRef.current?.reset();
        setContacts([]);
        setCurrentPassword('');
        setCustomCategories([]); // 重置自定义类别
        clearEdit(); // 清除编辑状态，避免刷新后仍填充
        // 重置后重新设置录入人字段
        setTimeout(() => {
            formRef.current?.setValue('entryPerson', currentUser || '');
        }, 100);
        Toast.info('表单已重置');
    };

    // 预填表单值
    useEffect(() => {
        if (editVendor && formRef.current) {
            const initVals: any = { ...editVendor };
            initVals.regions = (editVendor as any).regions || [editVendor.region];
            initVals.brands = (editVendor.brands || []).join(',');
            formRef.current.setValues(initVals);
        }
    }, [editVendor]);

    useEffect(() => {
        console.log('💾 editVendor on mount', editVendor);
    }, [editVendor]);

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <Title heading={3}>供应商信息录入</Title>
            
            <Card style={{ marginTop: '20px' }}>
                <Form<VendorFormData>
                    getFormApi={(formApi) => (formRef.current = formApi)}
                    onSubmit={handleSubmit}
                    layout="horizontal"
                    labelPosition="left"
                    labelWidth="120px"
                >
                    {/* 基本信息标题 */}
                    <div style={{ 
                        width: '100%', 
                        marginBottom: '24px',
                        position: 'relative',
                        left: '-120px',
                        paddingLeft: '120px'
                    }}>
                        <Title heading={4} style={{ 
                            marginBottom: '16px', 
                            borderBottom: '2px solid #1890ff', 
                            paddingBottom: '8px', 
                            width: 'fit-content'
                        }}>基本信息</Title>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '20px' }}>
                        <Form.Input
                            field="englishName"
                            label="供应商名称(英文)"
                            placeholder="请输入英文名称"
                            rules={[{ required: true, message: '请填写英文名称' }]}
                        />

                        <Form.Input
                            field="chineseName"
                            label="供应商名称(中文)"
                            placeholder="请输入中文名称(可选)"
                        />
                        
                        <Form.Select
                            field="type"
                            label="供应商类型"
                            placeholder="请选择供应商类型"
                            optionList={getAllVendorTypes()}
                            onChange={handleVendorTypeChange}
                            rules={[{ required: true, message: '请选择供应商类型' }]}
                        />
                        
                        <Form.Select
                            field="regions"
                            label="所在地区"
                            multiple
                            placeholder="请选择所在地区"
                            optionList={getAllRegions().map(region => ({ label: region, value: region }))}
                            onChange={handleRegionsChange}
                            rules={[{ required: true, message: '请选择所在地区' }]}
                        />
                        
                        <Form.Select
                            field="category"
                            label="产品类别"
                            multiple
                            placeholder="请选择产品类别"
                            optionList={getAllProductCategories().map(cat => ({ label: cat, value: cat }))}
                            onChange={handleCategoryChange}
                        />
                        
                        <Form.Input
                            field="website"
                            label="官方网站"
                            placeholder="请输入官方网站"
                        />
                        
                        <Form.Input
                            field="brands"
                            label="代理品牌"
                            placeholder="请输入代理品牌，多个用逗号分隔"
                        />

                        <Form.TextArea
                            field="reportMethod"
                            label="售后/故障联系"
                            placeholder="请输入售后/故障联系信息，如电话、邮件或工单系统等"
                            autosize={{ minRows: 3, maxRows: 5 }}
                            style={{ marginBottom: '20px', gridColumn: '1 / span 2' }}
                        />
                        
                        <Form.Select
                            field="agentType"
                            label="代理资质"
                            placeholder="请选择代理资质"
                            optionList={getAllAgentTypes()}
                            onChange={handleAgentQualificationChange}
                        />
                        
                        <Form.Select
                            field="status"
                            label="状态"
                            placeholder="请选择状态"
                            optionList={STATUS_OPTIONS}
                            initValue="active"
                        />
                    </div>

                    <Form.TextArea
                        field="address"
                        label="公司地址"
                        placeholder="请输入公司地址"
                        autosize={{ minRows: 2, maxRows: 4 }}
                        style={{ marginBottom: '20px' }}
                    />

                    <Form.TextArea
                        field="remarks"
                        label="备注信息"
                        placeholder="请输入备注信息"
                        autosize={{ minRows: 3, maxRows: 5 }}
                        style={{ marginBottom: '20px', gridColumn: '1 / span 2' }}
                    />

                    <Divider margin="24px" />

                    {/* 联系人管理标题 */}
                    <div style={{ 
                        width: '100%', 
                        marginBottom: '24px',
                        position: 'relative',
                        left: '-120px',
                        paddingLeft: '120px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <Title heading={4} style={{ 
                                marginBottom: '0', 
                                borderBottom: '2px solid #1890ff', 
                                paddingBottom: '8px', 
                                width: 'fit-content'
                            }}>
                                联系人管理
                                <span style={{color: '#ff4d4f', fontSize: '12px', marginLeft: '8px', fontWeight: 'normal'}}>
                                    (必须添加至少一个联系人)
                                </span>
                            </Title>
                            <Button
                                type="primary"
                                theme="solid"
                                icon={<IconPlus />}
                                onClick={handleAddContact}
                            >
                                添加联系人
                            </Button>
                        </div>
                    </div>

                    {/* 联系人管理表格 */}
                    <div style={{ 
                        marginBottom: '20px', 
                        position: 'relative',
                        left: '-120px',
                        paddingLeft: '120px'
                    }}>
                        <Table
                            columns={contactColumns}
                            dataSource={contacts}
                            pagination={false}
                            size="small"
                            empty={
                                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                                    <Text>暂无联系人，请点击"添加联系人"按钮添加</Text>
                                </div>
                            }
                        />
                    </div>

                    <Divider margin="24px" />

                    {/* 账户信息标题 */}
                    <div style={{ 
                        width: '100%', 
                        marginBottom: '24px',
                        position: 'relative',
                        left: '-120px',
                        paddingLeft: '120px'
                    }}>
                        <Title heading={4} style={{ 
                            marginBottom: '16px', 
                            borderBottom: '2px solid #1890ff', 
                            paddingBottom: '8px', 
                            width: 'fit-content'
                        }}>账户信息（可选）</Title>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '20px' }}>
                    <Form.Input
                            field="account"
                            label="登录账号"
                            placeholder="请输入登录账号"
                        />
                        
                        <div>
                            <Form.Input
                                field="password"
                                label="登录密码"
                                placeholder="点击右侧按钮设置密码"
                                disabled
                                suffix={
                                    <Button
                                        type="tertiary"
                                        theme="borderless"
                                        size="small"
                                        onClick={() => setPasswordVisible(true)}
                                        style={{ 
                                            color: '#1890ff',
                                            padding: '4px 8px'
                                        }}
                                    >
                                        设置密码
                                    </Button>
                                }
                            />
                        </div>
                    </div>

                    <Divider margin="24px" />

                    {/* 其他信息标题 */}
                    <div style={{ 
                        width: '100%', 
                        marginBottom: '24px',
                        position: 'relative',
                        left: '-120px',
                        paddingLeft: '120px'
                    }}>
                        <Title heading={4} style={{ 
                            marginBottom: '16px', 
                            borderBottom: '2px solid #1890ff', 
                            paddingBottom: '8px', 
                            width: 'fit-content'
                        }}>其他信息</Title>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '20px' }}>
                    <Form.Input
                            field="entryPerson"
                            label="录入人"
                            placeholder="当前登录用户"
                            initValue={currentUser || ''}
                            disabled
                            style={{ 
                                backgroundColor: 'var(--semi-color-fill-0)',
                                color: 'var(--semi-color-text-1)'
                            }}
                        />
                        
                        <Form.DatePicker
                            field="entryTime"
                            label="录入时间"
                            style={{ width: '100%' }}
                            initValue={new Date()}
                        />
                    </div>

                    {/* 附件上传 */}
                    <div style={{ marginBottom: '24px' }}>
                        <Upload
                            multiple
                            limit={20}
                            listType="list"
                            beforeUpload={(file) => {
                                // 阻止自动上传，统一提交
                                return false;
                            }}
                            onChange={({ fileList }) => {
                                // fileList 为 UploadFileInfo[]
                                const raws: File[] = fileList
                                    .map((item: any) => item.fileInstance || item.originFileObj)
                                    .filter(Boolean);
                                setAttachments(raws);
                            }}
                        >
                            <Button icon={<IconPlus />}>选择附件</Button>
                        </Upload>
                    </div>

                    {/* 提交按钮区域 */}
                    <div style={{ textAlign: 'center', marginTop: '32px' }}>
                        <Space spacing={24}>
                            <Button 
                                size="large"
                                onClick={handleReset}
                            >
                                重置表单
                            </Button>
                            <Button
                                type="primary"
                                size="large"
                                htmlType="submit" 
                                loading={loading}
                            >
                                保存供应商信息
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Card>

            {/* 联系人编辑弹窗 */}
            <Modal
                title={editingContact ? '编辑联系人' : '添加联系人'}
                visible={contactModalVisible}
                onCancel={() => {
                    setContactModalVisible(false);
                    contactFormRef.current?.reset();
                }}
                footer={null}
                width={600}
            >
                <Form<ContactFormData>
                    getFormApi={(formApi) => (contactFormRef.current = formApi)}
                    onSubmit={handleSaveContact}
                    labelPosition="left"
                    labelWidth="80px"
                    initValues={editingContact || undefined}
                >
                    <Form.Input
                        field="name"
                        label="姓名"
                        placeholder="请输入联系人姓名"
                        rules={[{ required: true, message: '请填写联系人姓名' }]}
                    />
                    
                    <Form.Input
                        field="position"
                        label="职位"
                        placeholder="请输入职位"
                    />
                    
                    <Form.Input
                        field="phone"
                        label="电话"
                        placeholder="请输入联系电话"
                        rules={[
                            {
                                validator: (_: any, value: string, callback: (error?: string)=>void) => {
                                    const wechatVal = contactFormRef.current?.getValue('wechat');
                                    if (!value && !wechatVal) { callback('电话或微信必须填写其中一项'); return false; }
                                    if (value && !/^[\d\s\-\+\(\)]+$/.test(value)) { callback('请输入有效的电话号码'); return false; }
                                    callback();
                                    return true;
                                }
                            }
                        ]}
                    />
                    
                    <Form.Input
                        field="email"
                        label="邮箱"
                        placeholder="请输入邮箱地址"
                        rules={[
                            { required: true, message: '请填写邮箱地址' },
                            { type: 'email', message: '请输入有效的邮箱地址' }
                        ]}
                    />
                    
                    <Form.Input
                        field="wechat"
                        label="联系微信"
                        placeholder="请输入微信号（可选）"
                        rules={[
                            {
                                validator: (_: any, value: string, callback: (error?: string)=>void) => {
                                    const phoneVal = contactFormRef.current?.getValue('phone');
                                    if (!value && !phoneVal) { callback('电话或微信必须填写其中一项'); return false; }
                                    callback();
                                    return true;
                                }
                            }
                        ]}
                    />
                    
                    <Form.Switch
                        field="isPrimary"
                        label="主要联系人"
                        checkedText="是"
                        uncheckedText="否"
                    />
                    
                    <Form.TextArea
                        field="remarks"
                        label="备注"
                        placeholder="请输入备注信息"
                        autosize={{ minRows: 3, maxRows: 5 }}
                    />
                    
                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <Space>
                            <Button onClick={() => {
                                setContactModalVisible(false);
                                contactFormRef.current?.reset();
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                保存
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Modal>

            {/* 密码设置弹窗 */}
            <Modal
                title="设置登录密码"
                visible={passwordVisible}
                onCancel={() => setPasswordVisible(false)}
                footer={
                    <Space>
                        <Button onClick={() => setPasswordVisible(false)}>取消</Button>
                        <Button type="primary" onClick={handlePasswordSave}>确定</Button>
                    </Space>
                }
            >
                <Input
                    type="password"
                    placeholder="请输入登录密码"
                    value={currentPassword}
                    onChange={(value: string) => setCurrentPassword(value)}
                    style={{ width: '100%' }}
                />
            </Modal>

            {/* 自定义产品类别弹窗 */}
            <Modal
                title="添加自定义产品类别"
                visible={customCategoryModalVisible}
                onCancel={() => {
                    setCustomCategoryModalVisible(false);
                    setCurrentCustomCategory('');
                    // 移除表单中的"添加其他"选项
                    const currentValues = formRef.current?.getValue('category') || [];
                    const newValues = currentValues.filter((val: string) => val !== '添加其他');
                    formRef.current?.setValue('category', newValues);
                }}
                footer={
                    <Space>
                        <Button onClick={() => {
                            setCustomCategoryModalVisible(false);
                            setCurrentCustomCategory('');
                            // 移除表单中的"添加其他"选项
                            const currentValues = formRef.current?.getValue('category') || [];
                            const newValues = currentValues.filter((val: string) => val !== '添加其他');
                            formRef.current?.setValue('category', newValues);
                        }}>取消</Button>
                        <Button type="primary" onClick={handleSaveCustomCategory}>确定</Button>
                    </Space>
                }
                width={500}
            >
                <div style={{ marginBottom: '16px' }}>
                    <Text type="secondary">
                        请输入自定义的产品类别名称，添加后可在产品类别中选择使用。
                    </Text>
                </div>
                <Input
                    placeholder="请输入产品类别名称，如：AI服务器、存储阵列等"
                    value={currentCustomCategory}
                    onChange={setCurrentCustomCategory}
                    autoFocus
                    maxLength={20}
                />
                {customCategories.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <Text strong>已添加的自定义类别：</Text>
                        <div style={{ marginTop: '8px' }}>
                            <Space wrap>
                                {customCategories.map((category, index) => (
                                    <Tag key={index} color="blue" type="light">
                                        {category}
                                    </Tag>
                                ))}
                            </Space>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 自定义供应商类型弹窗 */}
            <Modal
                title="添加自定义供应商类型"
                visible={customTypeModalVisible}
                onCancel={() => {
                    setCustomTypeModalVisible(false);
                    setCurrentCustomType('');
                }}
                footer={
                    <Space>
                        <Button onClick={() => {
                            setCustomTypeModalVisible(false);
                            setCurrentCustomType('');
                        }}>取消</Button>
                        <Button type="primary" onClick={handleSaveCustomVendorType}>确定</Button>
                    </Space>
                }
                width={500}
            >
                <div style={{ marginBottom: '16px' }}>
                    <Text type="secondary">
                        请输入自定义的供应商类型名称，添加后可在供应商类型中选择使用。
                    </Text>
                </div>
                <Input
                    placeholder="请输入供应商类型名称，如：云服务提供商、系统集成商等"
                    value={currentCustomType}
                    onChange={setCurrentCustomType}
                    autoFocus
                    maxLength={20}
                />
                {customTypes.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <Text strong>已添加的自定义类型：</Text>
                        <div style={{ marginTop: '8px' }}>
                            <Space wrap>
                                {customTypes.map((type, index) => (
                                    <Tag key={index} color="blue" type="light">
                                        {type}
                                    </Tag>
                                ))}
                            </Space>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 自定义代理资质弹窗 */}
            <Modal
                title="添加自定义代理资质"
                visible={customAgentModalVisible}
                onCancel={() => {
                    setCustomAgentModalVisible(false);
                    setCurrentCustomAgentType('');
                }}
                footer={
                    <Space>
                        <Button onClick={() => {
                            setCustomAgentModalVisible(false);
                            setCurrentCustomAgentType('');
                        }}>取消</Button>
                        <Button type="primary" onClick={handleSaveCustomAgent}>确定</Button>
                    </Space>
                }
                width={500}
            >
                <div style={{ marginBottom: '16px' }}>
                    <Text type="secondary">
                        请输入自定义的代理资质名称，添加后可在代理资质中选择使用。
                                </Text>
                </div>
                <Input
                    placeholder="请输入代理资质名称，如：金牌代理、认证合作伙伴等"
                    value={currentCustomAgentType}
                    onChange={setCurrentCustomAgentType}
                    autoFocus
                    maxLength={20}
                />
                {customAgentTypes.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <Text strong>已添加的自定义资质：</Text>
                        <div style={{ marginTop: '8px' }}>
                            <Space wrap>
                                {customAgentTypes.map((type, index) => (
                                    <Tag key={index} color="blue" type="light">
                                        {type}
                                    </Tag>
                                ))}
                            </Space>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 自定义地区弹窗 */}
            <Modal
                title="添加自定义地区"
                visible={customRegionModalVisible}
                onCancel={() => {
                    setCustomRegionModalVisible(false);
                    setCurrentCustomRegion('');
                }}
                footer={
                    <Space>
                        <Button onClick={() => {
                            setCustomRegionModalVisible(false);
                            setCurrentCustomRegion('');
                        }}>取消</Button>
                        <Button type="primary" onClick={handleSaveCustomLocation}>确定</Button>
                    </Space>
                }
                width={500}
            >
                <div style={{ marginBottom: '16px' }}>
                    <Text type="secondary">
                        请输入自定义的地区名称，添加后可在所在地区中选择使用。
                                </Text>
                            </div>
                <Input
                    placeholder="请输入地区名称，如：粤港澳大湾区、长三角等"
                    value={currentCustomRegion}
                    onChange={setCurrentCustomRegion}
                    autoFocus
                    maxLength={20}
                />
                {customRegions.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <Text strong>已添加的自定义地区：</Text>
                        <div style={{ marginTop: '8px' }}>
                            <Space wrap>
                                {customRegions.map((region, index) => (
                                    <Tag key={index} color="blue" type="light">
                                        {region}
                                    </Tag>
                                ))}
                            </Space>
                        </div>
                    </div>
            )}
            </Modal>
        </div>
    );
};

export default VendorAdd; 