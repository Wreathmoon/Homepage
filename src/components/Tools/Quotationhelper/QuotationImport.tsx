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
    Card,
    Progress,
    Divider,
    Steps,
    Tag,
    Badge
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { IconUpload, IconPlay, IconTickCircle, IconEdit, IconTick, IconClose } from '@douyinfe/semi-icons';
import { request } from '../../../utils/request';
import { BeforeUploadProps, BeforeUploadObjectResult } from '@douyinfe/semi-ui/lib/es/upload';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';
import type { QuotationRecord } from '../../../services/quotationHistory';
import { PRODUCT_CATEGORIES, REGIONS } from '../../../services/quotationHistory';

const { Title, Text } = Typography;
const { Step } = Steps;

interface QuotationFormData {
    productName: string;
    vendor: string;
    category: string;
    region?: string;
    productSpec?: string;
    originalPrice?: number;
    finalPrice: number;
    quantity?: number;
    discount?: number;
    quotationDate?: string;
    remark?: string;
}

interface UploadedFileInfo {
    fileName: string;
    filePath: string;
    originalName: string;
    size: number;
    uploadTime: string;
}

interface AnalyzedQuotation extends QuotationFormData {
    id?: string;
    status: 'pending' | 'editing' | 'confirmed' | 'saved';
}

const QuotationImport: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
    const [analyzedData, setAnalyzedData] = useState<AnalyzedQuotation[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [editingData, setEditingData] = useState<QuotationFormData | null>(null);
    const [savedQuotations, setSavedQuotations] = useState<QuotationRecord[]>([]);
    const formRef = useRef<FormApi<any>>();

    // 第一步：仅上传文件
    const handleUpload = async (file: BeforeUploadProps): Promise<BeforeUploadObjectResult> => {
        console.log('📤 开始上传文件:', file);
        
        let actualFile: File | null = null;
        
        if (file instanceof File) {
            actualFile = file;
        } else if (file.file && file.file instanceof File) {
            actualFile = file.file;
        } else if (file.file?.fileInstance instanceof File) {
            actualFile = file.file.fileInstance;
        }
        
        if (!actualFile) {
            console.error('❌ 无法获取到有效的File对象');
            Toast.error('文件格式错误');
            return { status: 'error' as const };
        }
        
        const formData = new FormData();
        formData.append('file', actualFile);

        try {
            console.log('📤 向后端发送上传请求...');
            const response = await request.post('quotations/upload', formData) as any;
            console.log('✅ 文件上传成功:', response);
            
            setUploadedFile(response.fileInfo);
            setCurrentStep(1);
            Toast.success(`文件上传成功：${response.fileInfo.fileName}`);
            
            return { status: 'success' as const };
        } catch (error) {
            console.error('❌ 文件上传失败:', error);
            Toast.error('文件上传失败，请重试');
            return { status: 'error' as const };
        }
    };

    // 第二步：分析上传的文件
    const handleAnalyze = async () => {
        if (!uploadedFile) {
            Toast.error('请先上传文件');
            return;
        }

        setAnalyzing(true);
        try {
            console.log('🔍 开始分析文件...');
            const response = await request.post('quotations/analyze', {
                filePath: uploadedFile.filePath,
                fileName: uploadedFile.fileName
            }, {
                timeout: 60000 // AI分析设置60秒超时
            }) as any;
            
            console.log('✅ 文件分析成功:', response);
            
            if (response && Array.isArray(response) && response.length > 0) {
                const processedData = response.map((item: any) => ({
                    ...item,
                    status: 'pending' as const
                }));
                setAnalyzedData(processedData);
                setCurrentStep(2);
                setCurrentIndex(0);
                setTimeout(() => {
                    formRef.current?.setValues(processedData[0]);
                }, 100);
                Toast.success(`分析完成！识别到 ${response.length} 条产品记录`);
            } else if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
                const processedData = response.data.map((item: any) => ({
                    ...item,
                    status: 'pending' as const
                }));
                setAnalyzedData(processedData);
                setCurrentStep(2);
                setCurrentIndex(0);
                setTimeout(() => {
                    formRef.current?.setValues(processedData[0]);
                }, 100);
                Toast.success(`分析完成！识别到 ${response.data.length} 条产品记录`);
            } else {
                console.log('❌ 响应数据结构:', response);
                console.log('❌ 响应数据类型:', typeof response);
                Toast.warning('未识别到有效的产品数据');
            }
            
        } catch (error) {
            console.error('❌ 文件分析失败:', error);
            Toast.error('文件分析失败，请重试');
        } finally {
            setAnalyzing(false);
        }
    };

    // 第三步：编辑当前数据
    const handleEditCurrent = () => {
        const currentData = analyzedData[currentIndex];
        if (currentData) {
            setEditingData(currentData);
            formRef.current?.setValues(currentData);
            const updatedData = [...analyzedData];
            updatedData[currentIndex].status = 'editing';
            setAnalyzedData(updatedData);
        }
    };

    // 确认当前数据
    const handleConfirmCurrent = (values?: QuotationFormData) => {
        const dataToConfirm = values || analyzedData[currentIndex];
        const updatedData = [...analyzedData];
        updatedData[currentIndex] = {
            ...dataToConfirm,
            status: 'confirmed'
        };
        setAnalyzedData(updatedData);
        setEditingData(null);
        formRef.current?.reset();
        
        Toast.success('数据已确认');
        
        // 自动跳转到下一条
        if (currentIndex < analyzedData.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    // 跳过当前数据
    const handleSkipCurrent = () => {
        const updatedData = [...analyzedData];
        updatedData.splice(currentIndex, 1);
        setAnalyzedData(updatedData);
        
        if (updatedData.length === 0) {
            Toast.info('所有数据已处理完成');
            setCurrentStep(3);
        } else if (currentIndex >= updatedData.length) {
            setCurrentIndex(updatedData.length - 1);
        }
        
        setEditingData(null);
        formRef.current?.reset();
        Toast.info('已跳过当前数据');
    };

    // 保存所有确认的数据
    const handleSaveAll = async () => {
        const confirmedData = analyzedData.filter(item => item.status === 'confirmed');
        
        if (confirmedData.length === 0) {
            Toast.warning('没有已确认的数据可保存');
            return;
        }

        setSaving(true);
        try {
            const promises = confirmedData.map(item => 
                request.post('/products', item)
            );
            
            const responses = await Promise.all(promises);
            console.log('✅ 批量保存成功:', responses);
            
            setSavedQuotations(prev => [...prev, ...responses.map(r => r.data)]);
            setCurrentStep(3);
            Toast.success(`成功保存 ${confirmedData.length} 条记录到数据库`);
            
        } catch (error) {
            console.error('❌ 批量保存失败:', error);
            Toast.error('保存失败，请重试');
        } finally {
            setSaving(false);
        }
    };

    // 重新开始
    const handleRestart = () => {
        setCurrentStep(0);
        setUploadedFile(null);
        setAnalyzedData([]);
        setCurrentIndex(0);
        setEditingData(null);
        setSavedQuotations([]);
        formRef.current?.reset();
        Toast.info('已重置，可以重新上传文件');
    };

    // 手动添加
    const handleManualSubmit = async (values: QuotationFormData) => {
        setLoading(true);
        try {
            const response = await request.post('/products', values);
            Toast.success('手动添加成功');
            formRef.current?.reset();
            setSavedQuotations(prev => [...prev, response.data]);
        } catch (error) {
            Toast.error('添加失败，请重试');
            console.error('手动添加失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <Card style={{ marginTop: '20px' }}>
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <Upload
                                beforeUpload={handleUpload}
                                draggable
                                accept=".xlsx,.xls,.pdf,.docx"
                                limit={1}
                                dragMainText="点击上传或拖拽报价单到这里"
                                dragSubText="支持 Excel、PDF、Word 格式"
                                style={{
                                    border: '2px dashed var(--semi-color-primary)',
                                    borderRadius: '8px',
                                    padding: '60px 20px'
                                }}
                            />
                        </div>
                    </Card>
                );

            case 1:
                return (
                    <Card style={{ marginTop: '20px' }}>
                        <div style={{ 
                            padding: '40px 20px',
                            textAlign: 'center',
                            background: 'var(--semi-color-success-light-default)',
                            borderRadius: '8px'
                        }}>
                            <IconTickCircle size="large" style={{ color: 'var(--semi-color-success)', marginBottom: '16px' }} />
                            <Title heading={4} style={{ color: 'var(--semi-color-success)', marginBottom: '16px' }}>
                                文件上传成功
                            </Title>
                            
                            <div style={{ marginBottom: '24px', color: 'var(--semi-color-text-1)' }}>
                                <Text>文件名：{uploadedFile?.fileName}</Text><br />
                                <Text>文件大小：{uploadedFile ? (uploadedFile.size / 1024).toFixed(2) : 0} KB</Text><br />
                                <Text>上传时间：{uploadedFile ? new Date(uploadedFile.uploadTime).toLocaleString() : ''}</Text>
                            </div>
                            
                            <Button
                                type="primary"
                                icon={<IconPlay />}
                                onClick={handleAnalyze}
                                loading={analyzing}
                                size="large"
                            >
                                {analyzing ? '正在分析...' : '开始AI分析'}
                            </Button>
                            
                            {analyzing && (
                                <div style={{ marginTop: '20px' }}>
                                    <Text>正在使用AI大模型分析报价单内容，请稍候...</Text>
                                    <Progress percent={-1} style={{ marginTop: '12px' }} />
                                </div>
                            )}
                        </div>
                    </Card>
                );

            case 2:
                const currentData = analyzedData[currentIndex];
                const pendingCount = analyzedData.filter(item => item.status === 'pending').length;
                const confirmedCount = analyzedData.filter(item => item.status === 'confirmed').length;
                
                return (
                    <div style={{ marginTop: '20px' }}>
                        {/* 进度信息 */}
                        <Card style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Title heading={5}>数据预览与确认</Title>
                                    <Text>
                                        当前处理：第 {currentIndex + 1} 条 / 共 {analyzedData.length} 条
                                    </Text>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <Badge count={pendingCount} type="primary">
                                        <Tag color="blue">待处理</Tag>
                                    </Badge>
                                    <Badge count={confirmedCount} type="success">
                                        <Tag color="green">已确认</Tag>
                                    </Badge>
                                </div>
                            </div>
                        </Card>

                        {/* 数据编辑区域 */}
                        <Card>
                            <Form<any> 
                                getFormApi={(formApi) => (formRef.current = formApi)}
                                onSubmit={handleConfirmCurrent}
                                layout="horizontal"
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <Title heading={5}>
                                        产品信息 #{currentIndex + 1}
                                        {currentData?.status === 'editing' && <Tag color="orange" style={{ marginLeft: '8px' }}>编辑中</Tag>}
                                        {currentData?.status === 'confirmed' && <Tag color="green" style={{ marginLeft: '8px' }}>已确认</Tag>}
                                    </Title>
                                    <Space>
                                        <Button 
                                            type="secondary" 
                                            icon={<IconEdit />}
                                            onClick={handleEditCurrent}
                                            disabled={currentData?.status === 'editing'}
                                        >
                                            编辑
                                        </Button>
                                        <Button 
                                            type="primary" 
                                            icon={<IconTick />}
                                            onClick={() => handleConfirmCurrent()}
                                            disabled={currentData?.status === 'confirmed'}
                                        >
                                            确认
                                        </Button>
                                        <Button 
                                            type="danger" 
                                            icon={<IconClose />}
                                            onClick={handleSkipCurrent}
                                        >
                                            跳过
                                        </Button>
                                    </Space>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    <Form.Input
                                        field="productName"
                                        label="产品名称"
                                        placeholder="请输入产品名称"
                                        rules={[{ required: true, message: '请输入产品名称' }]}
                                        disabled={currentData?.status !== 'editing'}
                                    />
                                    <Form.Input
                                        field="vendor"
                                        label="供应商"
                                        placeholder="请输入供应商名称"
                                        rules={[{ required: true, message: '请输入供应商名称' }]}
                                        disabled={currentData?.status !== 'editing'}
                                    />
                                    <Form.Select
                                        field="category"
                                        label="产品类别"
                                        placeholder="请选择产品类别"
                                        rules={[{ required: true, message: '请选择产品类别' }]}
                                        disabled={currentData?.status !== 'editing'}
                                        optionList={PRODUCT_CATEGORIES.map(cat => ({
                                            label: cat,
                                            value: cat
                                        }))}
                                    />
                                    <Form.Select
                                        field="region"
                                        label="地区"
                                        placeholder="请选择地区"
                                        disabled={currentData?.status !== 'editing'}
                                        optionList={REGIONS.map(region => ({
                                            label: region,
                                            value: region
                                        }))}
                                    />
                                    <Form.InputNumber
                                        field="originalPrice"
                                        label="原始单价"
                                        placeholder="请输入原始单价"
                                        disabled={currentData?.status !== 'editing'}
                                        formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                        parser={value => value!.replace(/¥\s?|(,*)/g, '')}
                                    />
                                    <Form.InputNumber
                                        field="finalPrice"
                                        label="最终单价"
                                        placeholder="请输入最终单价"
                                        rules={[{ required: true, message: '请输入最终单价' }]}
                                        disabled={currentData?.status !== 'editing'}
                                        formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                        parser={value => value!.replace(/¥\s?|(,*)/g, '')}
                                    />
                                    <Form.InputNumber
                                        field="quantity"
                                        label="数量"
                                        placeholder="请输入数量"
                                        disabled={currentData?.status !== 'editing'}
                                    />
                                    <Form.InputNumber
                                        field="discount"
                                        label="折扣率"
                                        placeholder="请输入折扣率"
                                        disabled={currentData?.status !== 'editing'}
                                        formatter={value => `${value}%`}
                                        parser={value => value!.replace('%', '')}
                                        max={100}
                                        min={0}
                                    />
                                    <Form.DatePicker
                                        field="quotationDate"
                                        label="报价日期"
                                        placeholder="请选择报价日期"
                                        disabled={currentData?.status !== 'editing'}
                                    />
                                </div>
                                
                                <Form.TextArea
                                    field="productSpec"
                                    label="产品规格"
                                    placeholder="请输入产品规格详情"
                                    disabled={currentData?.status !== 'editing'}
                                    autosize={{ minRows: 2, maxRows: 4 }}
                                />
                                
                                <Form.TextArea
                                    field="remark"
                                    label="备注"
                                    placeholder="请输入备注信息"
                                    disabled={currentData?.status !== 'editing'}
                                    autosize={{ minRows: 2, maxRows: 4 }}
                                />

                                {currentData?.status === 'editing' && (
                                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                        <Button type="primary" htmlType="submit" size="large">
                                            保存修改
                                        </Button>
                                    </div>
                                )}
                            </Form>

                            {/* 导航按钮 */}
                            <Divider />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                    <Button 
                                        disabled={currentIndex === 0}
                                        onClick={() => {
                                            const newIndex = currentIndex - 1;
                                            setCurrentIndex(newIndex);
                                            // 自动填充表单数据
                                            if (analyzedData[newIndex]) {
                                                formRef.current?.setValues(analyzedData[newIndex]);
                                            }
                                        }}
                                    >
                                        上一条
                                    </Button>
                                    <Button 
                                        disabled={currentIndex === analyzedData.length - 1}
                                        onClick={() => {
                                            const newIndex = currentIndex + 1;
                                            setCurrentIndex(newIndex);
                                            // 自动填充表单数据
                                            if (analyzedData[newIndex]) {
                                                formRef.current?.setValues(analyzedData[newIndex]);
                                            }
                                        }}
                                    >
                                        下一条
                                    </Button>
                                </Space>
                                
                                <Button 
                                    type="primary" 
                                    size="large"
                                    loading={saving}
                                    onClick={handleSaveAll}
                                    disabled={confirmedCount === 0}
                                >
                                    保存全部已确认数据 ({confirmedCount})
                                </Button>
                            </div>
                        </Card>
                    </div>
                );

            case 3:
                return (
                    <Card style={{ marginTop: '20px' }}>
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <IconTickCircle size="extra-large" style={{ color: 'var(--semi-color-success)', marginBottom: '20px' }} />
                            <Title heading={3} style={{ color: 'var(--semi-color-success)', marginBottom: '16px' }}>
                                导入完成！
                            </Title>
                            <Text style={{ fontSize: '16px', marginBottom: '24px', display: 'block' }}>
                                成功保存了 {savedQuotations.length} 条产品记录
                            </Text>
                            <Space>
                                <Button type="primary" size="large" onClick={handleRestart}>
                                    继续导入
                                </Button>
                                <Button size="large" onClick={() => window.location.reload()}>
                                    查看历史记录
                                </Button>
                            </Space>
                        </div>
                    </Card>
                );

            default:
                return null;
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <Title heading={3}>智能报价单导入</Title>
            
            {/* 进度条 */}
            <Steps current={currentStep} style={{ marginTop: '20px' }}>
                <Step title="上传文件" description="选择报价单文件" />
                <Step title="AI分析" description="智能解析内容" />
                <Step title="确认数据" description="逐条检查确认" />
                <Step title="导入完成" description="保存到数据库" />
            </Steps>

            {/* 主要内容区域 */}
            {renderStepContent()}

            <Divider margin="40px" />

            {/* 手动添加区域 */}
            <Card>
                <Title heading={4}>手动添加产品</Title>
                <Form<any> 
                    onSubmit={handleManualSubmit}
                    layout="horizontal"
                    style={{ marginTop: '20px' }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
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
                            optionList={REGIONS.map(region => ({
                                label: region,
                                value: region
                            }))}
                        />
                        <Form.InputNumber
                            field="originalPrice"
                            label="原始单价"
                            placeholder="请输入原始单价"
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
                        />
                        <Form.InputNumber
                            field="discount"
                            label="折扣率"
                            placeholder="请输入折扣率"
                            formatter={value => `${value}%`}
                            parser={value => value!.replace('%', '')}
                            max={100}
                            min={0}
                        />
                        <Form.DatePicker
                            field="quotationDate"
                            label="报价日期"
                            placeholder="请选择报价日期"
                        />
                    </div>
                    
                    <Form.TextArea
                        field="productSpec"
                        label="产品规格"
                        placeholder="请输入产品规格详情"
                        autosize={{ minRows: 2, maxRows: 4 }}
                    />
                    
                    <Form.TextArea
                        field="remark"
                        label="备注"
                        placeholder="请输入备注信息"
                        autosize={{ minRows: 2, maxRows: 4 }}
                    />
                    
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <Button type="primary" htmlType="submit" loading={loading} size="large">
                            添加到数据库
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
};

export default QuotationImport; 