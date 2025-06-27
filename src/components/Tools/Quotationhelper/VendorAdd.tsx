import React, { useState, useRef } from 'react';
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
    DatePicker
} from '@douyinfe/semi-ui';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';
import { PRODUCT_CATEGORIES, REGIONS } from '../../../services/quotationHistory';
import { API_CONFIG } from '../../../utils/config';

const { Title, Text } = Typography;

// 定义供应商信息表单数据接口
interface VendorFormData {
    name: string;
    code?: string; // 自动生成，但需要传给后端
    category: string[];
    region: string;
    contact: string;
    phone: string;
    email: string;
    status: 'active' | 'inactive';
    remarks?: string;
    type: 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'OTHER';
    website?: string;
    brands?: string;
    agentType: 'GENERAL_AGENT' | 'AGENT' | 'OTHER';
    account?: string;
    password?: string;
    entryPerson: string;  // 录入人
    entryTime: string;    // 录入时间
}

// 供应商类型选项
const VENDOR_TYPES = [
    { label: '硬件供应商', value: 'HARDWARE' },
    { label: '软件供应商', value: 'SOFTWARE' },
    { label: '服务供应商', value: 'SERVICE' },
    { label: '其他', value: 'OTHER' }
];

// 代理资质选项
const AGENT_TYPE_OPTIONS = [
    { label: '总代理', value: 'GENERAL_AGENT' },
    { label: '经销商', value: 'AGENT' },
    { label: '其他', value: 'OTHER' }
];

// 状态选项
const STATUS_OPTIONS = [
    { label: '激活', value: 'active' },
    { label: '禁用', value: 'inactive' }
];

const VendorAdd: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [savedVendors, setSavedVendors] = useState<any[]>([]);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const formRef = useRef<FormApi<VendorFormData>>();

    // 自动生成供应商代码
    const generateVendorCode = (name: string) => {
        if (!name) return '';
        
        // 简单的代码生成逻辑：取中文名称首字母或英文名称前几位
        const timestamp = Date.now().toString().slice(-4);
        const nameCode = name.length > 0 ? name.substring(0, 3).toUpperCase() : 'VND';
        return `${nameCode}_${timestamp}`;
    };

    // 处理密码设置
    const handlePasswordSave = () => {
        formRef.current?.setValue('password', currentPassword);
        setPasswordVisible(false);
    };

    // 提交表单
    const handleSubmit = async (values: VendorFormData) => {
        setLoading(true);
        try {
            console.log('🔄 提交供应商信息:', values);
            
            // 自动生成供应商代码
            const submitData = {
                ...values,
                code: generateVendorCode(values.name),
                // 确保必填字段有默认值
                name: values.name || '',
                contact: values.contact || '未填写',
                email: values.email || '',
                phone: values.phone || '',
                type: values.type || 'HARDWARE',
                region: values.region || '',
                status: values.status || 'active',
                category: values.category || [],
                // 处理brands字段 - 后端期望数组格式
                brands: values.brands ? [values.brands] : [],
                // 添加密码
                password: currentPassword || '',
                // 将agentType转换为后端期望的布尔字段
                isGeneralAgent: values.agentType === 'GENERAL_AGENT',
                isAgent: values.agentType === 'AGENT',
                // 移除前端字段
                agentType: undefined,
                // 添加其他可能需要的字段
                website: values.website || '',
                remarks: values.remarks || '',
                account: values.account || '',
                // 添加录入信息
                entryPerson: values.entryPerson || '',
                entryTime: values.entryTime || new Date().toISOString().split('T')[0]
            };
            
            // 移除 undefined 字段
            Object.keys(submitData).forEach(key => {
                if ((submitData as any)[key] === undefined) {
                    delete (submitData as any)[key];
                }
            });
            
            console.log('🔄 处理后的数据:', submitData);
            
            // 调用API服务器的供应商添加接口
            const apiServerUrl = API_CONFIG.API_URL;
            const response = await fetch(`${apiServerUrl}/api/vendors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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
                Toast.success(result.message || '供应商信息保存成功');
                setSavedVendors(prev => [...prev, result.data]);
                
                // 重置表单
                formRef.current?.reset();
                setCurrentPassword('');
            } else {
                throw new Error(result.message || '保存失败');
            }
            
        } catch (error) {
            console.error('❌ 供应商保存失败:', error);
            
            // 检查是否是网络连接错误
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
        setCurrentPassword('');
        Toast.info('表单已重置');
    };

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
                    <Title heading={4} style={{ marginBottom: '20px' }}>基本信息</Title>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '20px' }}>
                        <Form.Input
                            field="name"
                            label="供应商名称"
                            placeholder="请输入供应商名称"
                            rules={[{ required: true, message: '请输入供应商名称' }]}
                            size="large"
                        />
                        <Form.Input
                            field="phone"
                            label="联系电话"
                            placeholder="请输入联系电话"
                            rules={[
                                { required: true, message: '请输入联系电话' },
                                { pattern: /^[\d\-\+\(\)\s]+$/, message: '请输入有效的电话号码' }
                            ]}
                            size="large"
                        />
                        <Form.Input
                            field="contact"
                            label="联系人"
                            placeholder="请输入联系人姓名"
                            size="large"
                        />
                        <Form.Input
                            field="email"
                            label="邮箱地址"
                            placeholder="请输入邮箱地址"
                            rules={[
                                { type: 'email', message: '请输入有效的邮箱地址' }
                            ]}
                            size="large"
                        />
                    </div>

                    <Divider margin="24px" />
                    <Title heading={4} style={{ marginBottom: '20px' }}>业务信息</Title>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '20px' }}>
                        <Form.Select
                            field="type"
                            label="供应商类型"
                            placeholder="请选择供应商类型"
                            optionList={VENDOR_TYPES}
                            size="large"
                        />
                        <Form.Select
                            field="region"
                            label="主要地区"
                            placeholder="请选择主要地区"
                            optionList={REGIONS.map(region => ({
                                label: region,
                                value: region
                            }))}
                            size="large"
                        />
                        <Form.Select
                            field="status"
                            label="状态"
                            placeholder="请选择状态"
                            optionList={STATUS_OPTIONS}
                            initValue="active"
                            size="large"
                        />
                        <Form.Select
                            field="agentType"
                            label="代理资质"
                            placeholder="请选择代理资质"
                            optionList={AGENT_TYPE_OPTIONS}
                            size="large"
                        />
                    </div>

                    <Form.Select
                        field="category"
                        label="产品类别"
                        placeholder="请选择产品类别（可多选）"
                        multiple
                        optionList={PRODUCT_CATEGORIES.map(cat => ({
                            label: cat,
                            value: cat
                        }))}
                        style={{ marginBottom: '20px' }}
                        size="large"
                    />

                    <Form.Input
                        field="website"
                        label="官方网站"
                        placeholder="请输入官方网站地址"
                        style={{ marginBottom: '20px' }}
                        size="large"
                    />

                    <Form.Input
                        field="brands"
                        label="代理品牌"
                        placeholder="请输入代理品牌"
                        style={{ marginBottom: '20px' }}
                        size="large"
                    />

                    <Form.TextArea
                        field="remarks"
                        label="备注信息"
                        placeholder="请输入备注信息"
                        autosize={{ minRows: 3, maxRows: 6 }}
                        style={{ marginBottom: '20px' }}
                    />

                    <Divider margin="24px" />
                    <Title heading={4} style={{ marginBottom: '20px' }}>系统信息</Title>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '20px' }}>
                        <Form.Input
                            field="entryPerson"
                            label="录入人（必填）"
                            placeholder="请输入录入人姓名"
                            rules={[{ required: true, message: '请输入录入人姓名' }]}
                            size="large"
                        />
                        <Form.DatePicker
                            field="entryTime"
                            label="录入时间（必填）"
                            placeholder="请选择录入时间"
                            style={{ width: '100%' }}
                            format="yyyy-MM-dd"
                            initValue={new Date()}
                            rules={[{ required: true, message: '请选择录入时间' }]}
                            size="large"
                        />
                        <Form.Input
                            field="account"
                            label="系统账号"
                            placeholder="请输入系统账号"
                            size="large"
                        />
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                            <Button 
                                type="secondary" 
                                onClick={() => setPasswordVisible(true)}
                                size="large"
                            >
                                设置密码
                            </Button>
                        </div>
                    </div>

                    {/* 密码设置模态框 */}
                    <Modal
                        title="设置初始密码"
                        visible={passwordVisible}
                        onCancel={() => setPasswordVisible(false)}
                        onOk={handlePasswordSave}
                        width={400}
                    >
                        <div style={{ padding: '16px 0' }}>
                            <Typography.Text>为该供应商设置系统初始密码：</Typography.Text>
                            <Input
                                placeholder="请输入初始密码"
                                type="password"
                                value={currentPassword}
                                onChange={setCurrentPassword}
                                style={{ marginTop: '12px' }}
                                size="large"
                            />
                        </div>
                    </Modal>

                    {/* 操作按钮 */}
                    <div style={{ textAlign: 'center' }}>
                        <Space spacing={24}>
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                loading={loading}
                                size="large"
                            >
                                保存供应商信息
                            </Button>
                            <Button 
                                type="secondary" 
                                onClick={handleReset}
                                size="large"
                            >
                                重置表单
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Card>

            {/* 已保存的供应商列表 */}
            {savedVendors.length > 0 && (
                <Card style={{ marginTop: '30px' }}>
                    <Title heading={4} style={{ marginBottom: '16px' }}>
                        本次已保存的供应商 ({savedVendors.length})
                    </Title>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {savedVendors.map((vendor, index) => (
                            <div 
                                key={index} 
                                style={{ 
                                    padding: '12px', 
                                    background: 'var(--semi-color-success-light-default)',
                                    borderRadius: '6px',
                                    border: '1px solid var(--semi-color-success-light-active)'
                                }}
                            >
                                <Text strong style={{ color: 'var(--semi-color-success-6)' }}>
                                    {vendor.name}
                                </Text>
                                <Text style={{ marginLeft: '12px', color: 'var(--semi-color-text-2)' }}>
                                    联系人: {vendor.contact} | 类型: {vendor.type}
                                </Text>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default VendorAdd; 