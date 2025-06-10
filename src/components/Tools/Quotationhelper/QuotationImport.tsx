import React, { useState, useRef, useEffect } from 'react';
import { 
    Typography, 
    Form, 
    Button, 
    Table,
    Steps,
    Row, 
    Col,
    Upload,
    Toast,
    Space,
    Modal,
    Card,
    Descriptions,
    Badge,
    Avatar,
    List,
    Divider,
    Tooltip,
    Tag,
    Progress
} from '@douyinfe/semi-ui';
import { IconUpload, IconFile, IconTickCircle, IconClose, IconEdit, IconPlus, IconPlay, IconTick } from '@douyinfe/semi-icons';
import type { BeforeUploadProps, BeforeUploadObjectResult } from '@douyinfe/semi-ui/lib/es/upload';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';
import { request } from '../../../utils/request';
import { uploadQuotationFile, addQuotation } from '../../../services/quotation';
import type { QuotationRecord } from '../../../services/quotation';
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
    originalFile?: any; // 保存AI分析返回的原始文件信息
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
    const [duplicateDialogVisible, setDuplicateDialogVisible] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
    const [pendingProducts, setPendingProducts] = useState<any[]>([]);
    const [forceRender, setForceRender] = useState(0); // 强制重新渲染的标志
    const formRef = useRef<FormApi<any>>();

    // 监听currentIndex变化，自动填充表单数据
    useEffect(() => {
        if (currentStep === 2 && analyzedData.length > 0 && currentIndex >= 0 && currentIndex < analyzedData.length) {
            const currentData = analyzedData[currentIndex];
            if (currentData && formRef.current) {
                console.log(`🔄 Index变化，重新填充第${currentIndex + 1}条数据:`, currentData);
                setTimeout(() => {
                    formRef.current?.setValues(currentData);
                }, 50); // 短延迟确保表单已准备好
            }
        }
    }, [currentIndex, analyzedData, currentStep]);

    // 第一步：上传文件到AI服务器
    const handleUpload = async (file: BeforeUploadProps): Promise<BeforeUploadObjectResult> => {
        console.log('📤 开始上传文件到AI服务器:', file);
        
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

        try {
            console.log('📤 向AI服务器发送上传请求...');
            const formData = new FormData();
            formData.append('file', actualFile);
            
            // 调用AI服务器的上传API
            const aiServerUrl = process.env.REACT_APP_AI_SERVER_URL || 'http://localhost:3002';
            const response = await fetch(`${aiServerUrl}/api/quotations/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('服务器响应错误:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ 文件上传成功:', result);
            
            // 保存文件信息用于下一步分析
            setUploadedFile(result.fileInfo);
            setCurrentStep(1);
            Toast.success(`文件上传成功：${result.fileInfo.fileName}`);
            
            return { status: 'success' as const };
        } catch (error) {
            console.error('❌ 文件上传失败:', error);
            Toast.error('文件上传失败，请重试');
            return { status: 'error' as const };
        }
    };

    // 第二步：调用AI分析上传的文件
    const handleAnalyze = async () => {
        if (!uploadedFile) {
            Toast.error('请先上传文件');
            return;
        }

        setAnalyzing(true);
        let isDuplicateDetected = false;
        
        try {
            console.log('🔍 开始AI分析文件...');
            
            // 调用AI服务器的分析API
            const aiServerUrl = process.env.REACT_APP_AI_SERVER_URL || 'http://localhost:3002';
            const response = await fetch(`${aiServerUrl}/api/quotations/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filePath: uploadedFile.filePath,
                    fileName: uploadedFile.fileName
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('AI分析错误:', errorText);
                throw new Error(`分析失败: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ AI分析成功:', result);
            
            // 检查是否有重复
            if (result.isDuplicate) {
                console.log('🔍 检测到重复，准备显示对话框');
                console.log('📋 重复检测原始数据:', result);
                console.log('📋 duplicateInfo:', result.duplicateInfo);
                console.log('📋 validatedProducts:', result.validatedProducts);
                console.log('📋 products:', result.products);
                
                isDuplicateDetected = true;
                
                // 先关闭loading状态
                setAnalyzing(false);
                
                // 使用setTimeout确保状态更新完成后再显示对话框
                setTimeout(() => {
                    showDuplicateDialog(result);
                    console.log('✅ 重复检测对话框应该已显示');
                }, 100);
                
                return;
            }
            
            // 转换为组件期望的格式
            const productsData = result.products || result.data || [];
            console.log('🔍 AI返回的原始产品数据:', productsData);
            
            const formattedData: AnalyzedQuotation[] = productsData.map((item: any, index: number) => {
                const formatted = {
                    id: `analyzed-${index}`,
                    productName: item.productName || item.name || '',
                    vendor: item.supplier || '',
                    category: item.category || item.product_category || '其他',
                    region: item.region || undefined,
                    productSpec: item.productSpec || item.configDetail || '',
                    originalPrice: item.list_price || undefined,
                    finalPrice: item.quote_unit_price || 0,
                    quantity: item.quantity || 1,
                    discount: item.discount_rate ? item.discount_rate / 100 : undefined,
                    quotationDate: item.quote_validity ? new Date(item.quote_validity).toISOString().split('T')[0] : '',
                    remark: item.notes || '',
                    status: 'pending' as const,
                    originalFile: item.originalFile || null
                };
                
                // 调试：输出每条转换后的数据
                if (index < 5 || index === productsData.length - 1) { // 只输出前5条和最后一条，避免日志过多
                    console.log(`📋 第${index + 1}条转换后数据:`, formatted);
                }
                
                return formatted;
            });

            if (formattedData.length === 0) {
                Toast.warning('未能解析出有效的报价数据');
                return;
            }

            console.log(`✅ 数据转换完成，共${formattedData.length}条记录`);
            setAnalyzedData(formattedData);
            setCurrentStep(2);
            setCurrentIndex(0);
            
            // 自动填充第一条数据到表单
            setTimeout(() => {
                console.log('🔄 填充第一条数据到表单:', formattedData[0]);
                formRef.current?.setValues(formattedData[0]);
            }, 100);
            
            Toast.success(`成功分析出 ${formattedData.length} 条报价记录`);
            
        } catch (error) {
            console.error('❌ AI分析失败:', error);
            
            // 检查是否是网络连接错误
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                Toast.error('无法连接到AI服务器，请确保服务器正在运行 (端口3002)');
            } else if (error instanceof Error && error.message.includes('ERR_CONNECTION_REFUSED')) {
                Toast.error('连接被拒绝，请检查AI服务器状态');
            } else {
                Toast.error(`AI分析失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
        } finally {
            // 只有在非重复检测的情况下才重置analyzing状态
            if (!isDuplicateDetected) {
                setAnalyzing(false);
            }
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
            // 转换为AI服务器期望的格式
            const productsData = confirmedData.map(item => ({
                name: item.productName,
                productName: item.productName,
                supplier: item.vendor,
                quote_unit_price: item.finalPrice,
                list_price: item.originalPrice || item.finalPrice,
                quantity: item.quantity || 1,
                quote_total_price: (item.finalPrice * (item.quantity || 1)),
                quote_validity: item.quotationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                currency: 'EUR',
                notes: item.remark || '',
                configDetail: item.productSpec || '',
                category: item.category || '其他',
                region: item.region || undefined,
                status: 'active',
                // 优先使用产品自带的originalFile信息，如果没有则不传递（让服务器端重建）
                ...(item.originalFile ? { originalFile: item.originalFile } : {})
            }));

            console.log('🔄 使用AI服务器保存数据:', productsData.length, '条记录');
            console.log('📁 文件信息:', uploadedFile);

            // 调用AI服务器的确认保存API
            const aiServerUrl = process.env.REACT_APP_AI_SERVER_URL || 'http://localhost:3002';
            const response = await fetch(`${aiServerUrl}/api/quotations/confirm-save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    products: productsData,
                    action: 'save-all',
                    skipDuplicates: false,
                    fileInfo: uploadedFile ? {
                        fileName: uploadedFile.fileName,
                        filePath: uploadedFile.filePath,
                        originalName: uploadedFile.originalName,
                        size: uploadedFile.size
                    } : null
                })
            });

            if (!response.ok) {
                throw new Error(`保存失败: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ 批量保存成功:', result);
            
            if (result.savedCount > 0) {
                // 模拟原来的数据结构以保持兼容性
                const savedData = result.data || [];
                setSavedQuotations(prev => [...prev, ...savedData]);
                setCurrentStep(3);
                Toast.success(`成功保存 ${result.savedCount} 条记录到数据库`);
            } else {
                Toast.warning('没有数据被保存');
            }
            
        } catch (error) {
            console.error('❌ 批量保存失败:', error);
            
            // 检查是否是网络连接错误
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                Toast.error('无法连接到AI服务器，请确保服务器正在运行 (端口3002)');
            } else if (error instanceof Error && error.message.includes('ERR_CONNECTION_REFUSED')) {
                Toast.error('连接被拒绝，请检查AI服务器状态');
            } else {
                Toast.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
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
        setDuplicateDialogVisible(false);
        setDuplicateInfo(null);
        setPendingProducts([]);
        formRef.current?.reset();
        Toast.info('已重置，可以重新上传文件');
    };

    // 手动添加
    const handleManualSubmit = async (values: QuotationFormData) => {
        setLoading(true);
        try {
            // 转换数据格式以匹配后端接口
            const quotationData = {
                name: values.productName,
                productName: values.productName,
                supplier: values.vendor,
                quote_unit_price: values.finalPrice,
                list_price: values.originalPrice || values.finalPrice,
                quantity: values.quantity || 1,
                quote_total_price: (values.finalPrice * (values.quantity || 1)),
                quote_validity: values.quotationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                currency: 'EUR',
                notes: values.remark || '',
                configDetail: values.productSpec || '',
                category: values.category || '其他',
                ...(values.region && ['德国', '法国', '英国', '意大利', '西班牙', '荷兰', '比利时', '瑞士', '奥地利', '瑞典', '挪威', '丹麦', '芬兰', '波兰', '捷克', '匈牙利', '葡萄牙', '爱尔兰', '希腊', '美国', '加拿大', '其他'].includes(values.region) ? { region: values.region } : {}),
                status: 'active' as const
            };
            
            const response = await addQuotation(quotationData);
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

    // 显示重复检测对话框
    const showDuplicateDialog = (result: any) => {
        console.log('🔔 showDuplicateDialog被调用');
        console.log('📋 接收到的result:', result);
        
        const duplicateInfoData = result.duplicateInfo || result;
        const productsData = result.validatedProducts || result.products || [];
        const fileInfoData = result.fileInfo || null;
        
        console.log('📋 设置duplicateInfo:', duplicateInfoData);
        console.log('📋 设置pendingProducts:', productsData);
        console.log('📁 文件信息:', fileInfoData);
        
        // 批量更新状态
        const updateStates = () => {
            setDuplicateInfo(duplicateInfoData);
            setPendingProducts(productsData);
            setDuplicateDialogVisible(true);
            setForceRender(prev => prev + 1); // 强制重新渲染
            
            // 保存文件信息到uploadedFile状态（如果还没有的话）
            if (fileInfoData && !uploadedFile) {
                setUploadedFile({
                    fileName: fileInfoData.fileName,
                    filePath: fileInfoData.filePath,
                    originalName: fileInfoData.fileName,
                    size: 0,
                    uploadTime: new Date().toISOString()
                });
            }
        };
        
        // 强制设置对话框可见
        console.log('🔔 即将设置 duplicateDialogVisible = true');
        
        // 立即更新状态
        updateStates();
        
        // 额外的延迟确保状态生效
        setTimeout(() => {
            console.log('⏰ 延迟确认状态更新');
            setDuplicateDialogVisible(true);
            setForceRender(prev => prev + 1);
            console.log('📋 当前 duplicateDialogVisible 应该为 true');
        }, 10);
        
        console.log('✅ 重复检测对话框状态已设置完成');
    };

    // 处理重复确认
    const handleDuplicateAction = async (action: 'skip' | 'overwrite' | 'save-both') => {
        try {
            let products = pendingProducts;
            let skipDuplicates = false;

            if (action === 'skip') {
                skipDuplicates = true;
            } else if (action === 'overwrite') {
                // 对于覆盖操作，可能需要先删除现有记录
                // 这里暂时按正常保存处理
            }

            console.log('🔄 开始处理重复操作:', action);
            console.log('📋 产品数据:', products);

            // 调用确认保存API
            const aiServerUrl = process.env.REACT_APP_AI_SERVER_URL || 'http://localhost:3002';
            console.log('🌐 AI服务器地址:', aiServerUrl);
            
            const response = await fetch(`${aiServerUrl}/api/quotations/confirm-save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    products: products,
                    action: action,
                    skipDuplicates: skipDuplicates,
                    fileInfo: uploadedFile ? {
                        fileName: uploadedFile.fileName,
                        filePath: uploadedFile.filePath,
                        originalName: uploadedFile.originalName,
                        size: uploadedFile.size
                    } : null
                })
            });

            if (!response.ok) {
                throw new Error(`保存失败: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ 处理重复完成:', result);

            setDuplicateDialogVisible(false);
            setDuplicateInfo(null);
            setPendingProducts([]);

            if (result.savedCount > 0) {
                Toast.success(`${result.message}`);
                // 可以选择跳转到历史记录页面或刷新数据
            } else {
                Toast.info('未保存任何数据');
            }

        } catch (error) {
            console.error('❌ 处理重复失败:', error);
            
            // 检查是否是网络连接错误
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                Toast.error('无法连接到AI服务器，请确保服务器正在运行 (端口3002)');
            } else if (error instanceof Error && error.message.includes('ERR_CONNECTION_REFUSED')) {
                Toast.error('连接被拒绝，请检查AI服务器状态');
            } else {
                Toast.error(`处理失败：${error instanceof Error ? error.message : '未知错误'}`);
            }
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
                                                console.log(`⬅️ 切换到第${newIndex + 1}条数据:`, analyzedData[newIndex]);
                                                formRef.current?.setValues(analyzedData[newIndex]);
                                            } else {
                                                console.warn(`⚠️ 第${newIndex + 1}条数据不存在`);
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
                                                console.log(`➡️ 切换到第${newIndex + 1}条数据:`, analyzedData[newIndex]);
                                                formRef.current?.setValues(analyzedData[newIndex]);
                                            } else {
                                                console.warn(`⚠️ 第${newIndex + 1}条数据不存在`);
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

    // 渲染重复检测对话框
    const renderDuplicateDialog = () => {
        console.log('🎨 renderDuplicateDialog被调用');
        console.log('📋 duplicateDialogVisible:', duplicateDialogVisible);
        console.log('📋 duplicateInfo:', duplicateInfo);
        
        if (!duplicateDialogVisible || !duplicateInfo) {
            console.log('❌ 对话框不显示 - visible:', duplicateDialogVisible, 'info:', duplicateInfo);
            return null;
        }

        console.log('✅ 对话框将要渲染');
        const { existingFile, productDuplicates } = duplicateInfo;

        return (
            <Modal
                title="检测到重复内容"
                visible={duplicateDialogVisible}
                onCancel={() => {
                    setDuplicateDialogVisible(false);
                    setDuplicateInfo(null);
                    setPendingProducts([]);
                    // 取消重复检测后给出提示
                    Toast.info('已取消处理，您可以重新进行AI分析或手动添加报价');
                }}
                footer={null}
                width={800}
                style={{ top: '10vh' }}
            >
                <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                    {/* 文件重复提示 */}
                    {existingFile && (
                        <Card style={{ marginBottom: '16px', background: 'var(--semi-color-warning-light-default)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                <Badge count="!" type="warning" style={{ marginRight: '8px' }} />
                                <Title heading={5} style={{ margin: 0, color: 'var(--semi-color-warning-6)' }}>
                                    相同文件已存在
                                </Title>
                            </div>
                            <Descriptions data={[
                                { key: '原文件名', value: existingFile.fileName },
                                { key: '产品名称', value: existingFile.productName },
                                { key: '上传时间', value: new Date(existingFile.uploadDate).toLocaleString() },
                            ]} />
                        </Card>
                    )}

                    {/* 产品重复提示 */}
                    {productDuplicates && productDuplicates.length > 0 && (
                        <Card style={{ marginBottom: '16px', background: 'var(--semi-color-info-light-default)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                <Badge count={productDuplicates.length} type="primary" style={{ marginRight: '8px' }} />
                                <Title heading={5} style={{ margin: 0, color: 'var(--semi-color-primary-6)' }}>
                                    发现相似产品记录
                                </Title>
                            </div>
                            
                            {productDuplicates.map((dup: any, index: number) => (
                                <div key={index} style={{ marginBottom: '16px' }}>
                                    <Text strong>新产品：{dup.newProduct.productName}</Text>
                                    <div style={{ marginTop: '8px', marginLeft: '16px' }}>
                                        <Text type="secondary">
                                            供应商：{dup.newProduct.supplier} | 
                                            单价：¥{dup.newProduct.quote_unit_price} | 
                                            数量：{dup.newProduct.quantity}
                                        </Text>
                                    </div>
                                    
                                    <div style={{ marginTop: '8px' }}>
                                        <Text strong style={{ color: 'var(--semi-color-danger-6)' }}>
                                            相似的现有记录：
                                        </Text>
                                        {dup.existingProducts.map((existing: any, i: number) => (
                                            <div key={i} style={{ marginLeft: '16px', marginTop: '4px' }}>
                                                <Text type="secondary">
                                                    {existing.productName} - {existing.supplier} - 
                                                    ¥{existing.unitPrice} × {existing.quantity} - 
                                                    {new Date(existing.uploadDate).toLocaleDateString()}
                                                    {existing.originalFileName && (
                                                        <span> - {existing.originalFileName}</span>
                                                    )}
                                                </Text>
                                            </div>
                                        ))}
                                    </div>
                                    {index < productDuplicates.length - 1 && <Divider />}
                                </div>
                            ))}
                        </Card>
                    )}

                    {/* 待保存的产品预览 */}
                    <Card>
                        <Title heading={5} style={{ marginBottom: '12px' }}>
                            待保存的产品 ({pendingProducts.length} 个)
                        </Title>
                        <List
                            dataSource={pendingProducts}
                            size="small"
                            renderItem={(item: any) => (
                                <List.Item>
                                    <div>
                                        <Text strong>{item.productName}</Text>
                                        <br />
                                        <Text type="secondary">
                                            {item.supplier} - ¥{item.quote_unit_price} × {item.quantity}
                                        </Text>
                                    </div>
                                </List.Item>
                            )}
                        />
                    </Card>
                </div>

                {/* 操作按钮 */}
                <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--semi-color-border)' }}>
                    <Space>
                        <Button 
                            type="tertiary" 
                            onClick={() => handleDuplicateAction('skip')}
                        >
                            跳过重复项
                        </Button>
                        <Button 
                            type="warning" 
                            onClick={() => handleDuplicateAction('overwrite')}
                        >
                            全部保存
                        </Button>
                        <Button 
                            onClick={() => {
                                setDuplicateDialogVisible(false);
                                setDuplicateInfo(null);
                                setPendingProducts([]);
                                // 取消重复检测后给出提示
                                Toast.info('已取消处理，您可以重新进行AI分析或手动添加报价');
                            }}
                        >
                            取消
                        </Button>
                    </Space>
                </div>
            </Modal>
        );
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* 重复检测对话框 */}
            {renderDuplicateDialog()}
            
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