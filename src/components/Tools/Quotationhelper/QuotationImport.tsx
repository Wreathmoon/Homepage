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
    Progress,
    Switch
} from '@douyinfe/semi-ui';
import { IconUpload, IconFile, IconTickCircle, IconClose, IconEdit, IconPlus, IconPlay, IconTick, IconAlertTriangle } from '@douyinfe/semi-icons';
import type { BeforeUploadProps, BeforeUploadObjectResult } from '@douyinfe/semi-ui/lib/es/upload';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';
import { request } from '../../../utils/request';
import { uploadQuotationFile, addQuotation } from '../../../services/quotation';
import type { QuotationRecord } from '../../../services/quotation';
import { PRODUCT_CATEGORIES, REGIONS } from '../../../services/quotationHistory';

const { Title, Text } = Typography;
const { Step } = Steps;

// 币种选项
const CURRENCIES = [
    { label: '人民币 (¥)', value: 'CNY', symbol: '¥' },
    { label: '美元 ($)', value: 'USD', symbol: '$' },
    { label: '欧元 (€)', value: 'EUR', symbol: '€' },
    { label: '英镑 (£)', value: 'GBP', symbol: '£' },
    { label: '日元 (¥)', value: 'JPY', symbol: '¥' },
    { label: '韩元 (₩)', value: 'KRW', symbol: '₩' },
    { label: '印度卢比 (₹)', value: 'INR', symbol: '₹' },
    { label: '加拿大元 (C$)', value: 'CAD', symbol: 'C$' },
    { label: '澳大利亚元 (A$)', value: 'AUD', symbol: 'A$' },
    { label: '瑞士法郎 (CHF)', value: 'CHF', symbol: 'CHF' },
];

interface QuotationFormData {
    productName: string;
    vendor: string;
    category: string;
    region?: string;
    productSpec?: string;
    originalPrice?: number; // List Price
    unitPrice?: number; // 设备单价（单个设备价格）
    finalPrice: number; // 折后总价（到手价）
    quantity?: number;
    discount?: number;
    quotationDate?: string;
    currency?: string;
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
    const [currentCurrency, setCurrentCurrency] = useState('CNY'); // 当前选择的币种
    const [enableDetailedAI, setEnableDetailedAI] = useState<boolean>(true); // AI详细识别开关
    
    // 文件重复相关状态
    const [fileExistsDialogVisible, setFileExistsDialogVisible] = useState(false);
    const [existingFileInfo, setExistingFileInfo] = useState<any>(null);
    
    const formRef = useRef<FormApi<any>>();

    // 监听currentIndex变化，自动填充表单数据
    useEffect(() => {
        if (currentStep === 2 && analyzedData.length > 0 && currentIndex >= 0 && currentIndex < analyzedData.length) {
            const currentData = analyzedData[currentIndex];
            if (currentData && formRef.current) {
                console.log(`🔄 Index变化，重新填充第${currentIndex + 1}条数据:`, currentData);
                // 更新当前币种
                setCurrentCurrency(currentData.currency || 'CNY');
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
        let timeoutId: NodeJS.Timeout | undefined; // 声明timeoutId变量
        
        try {
            console.log('🔍 开始AI分析文件...');
            
            // 创建AbortController用于超时控制
            const controller = new AbortController();
            timeoutId = setTimeout(() => {
                controller.abort();
            }, 360000); // 6分钟超时（比后端多1分钟）
            
            // 调用AI服务器的分析API
            const aiServerUrl = process.env.REACT_APP_AI_SERVER_URL || 'http://localhost:3002';
            const response = await fetch(`${aiServerUrl}/api/quotations/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal, // 添加超时控制
                body: JSON.stringify({
                    filePath: uploadedFile.filePath,
                    fileName: uploadedFile.fileName,
                    enableDetailedAI: enableDetailedAI // 传递开关状态
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('AI分析错误:', errorText);
                throw new Error(`分析失败: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ AI分析成功:', result);
            
            // 清除超时定时器
            if (timeoutId) clearTimeout(timeoutId);
            
            // 检查是否有重复
            if (result.isDuplicate) {
                console.log('🔍 检测到重复，准备显示对话框');
                console.log('📋 重复检测原始数据:', result);
                
                isDuplicateDetected = true;
                
                // 先关闭loading状态
                setAnalyzing(false);
                
                // 检查是否是文件重复
                if (result.duplicateType === 'file') {
                    // 文件重复 - 显示专门的文件重复弹窗
                    setTimeout(() => {
                        showFileExistsDialog(result);
                        console.log('✅ 文件重复对话框应该已显示');
                    }, 100);
                } else {
                    // 产品重复 - 显示原有的重复检测弹窗
                    setTimeout(() => {
                        showDuplicateDialog(result);
                        console.log('✅ 重复检测对话框应该已显示');
                    }, 100);
                }
                
                return;
            }
            
            // 转换为组件期望的格式
            const productsData = result.products || result.data || [];
            console.log('🔍 AI返回的原始产品数据:', productsData);
            console.log('🔍 AI返回的完整结果结构:', result);
            
            if (!productsData || !Array.isArray(productsData)) {
                console.error('❌ AI返回的产品数据格式错误:', productsData);
                Toast.error('AI分析结果格式错误，请重试');
                return;
            }
            
            const formattedData: AnalyzedQuotation[] = productsData.map((item: any, index: number) => {
                // 产品名称识别 - 优先级更新
                const productName = item.quotationTitle || item.productName || item.name || 
                                   item.title || item.description || item.product_name || 
                                   item.detailedComponents || '未识别产品';
                
                // 价格字段映射 - 不进行任何计算，直接使用AI返回的值
                const listPrice = item.totalPrice || item.list_price || item.listPrice || 
                                 item.standardPrice || item.msrp || item.retail_price || undefined;
                
                const unitPrice = item.unitPrice || item.unit_price || item.single_price || 
                                 item.item_price || item.device_price || undefined;
                
                const quantity = item.quantity || item.qty || item.units || item.pieces || 1;
                
                // 确保finalPrice不为0，至少为1
                const rawFinalPrice = item.discountedTotalPrice || item.final_price || item.finalPrice || 
                                     item.total_price || item.quote_total_price || item.grand_total || 
                                     item.quote_total || item.amount_due || item.totalPrice;
                const finalPrice = rawFinalPrice || (listPrice && quantity ? listPrice * quantity : 1);
                
                // 供应商识别 - 排除设备制造商
                const deviceBrands = ['Dell', 'HP', 'Cisco', 'IBM', 'Lenovo', 'Microsoft', 'VMware', 'Oracle', 'Intel', 'AMD'];
                let vendor = '';
                let manufacturer = '';
                
                if (item.supplier && !deviceBrands.includes(item.supplier)) {
                    vendor = item.supplier;
                } else if (item.vendor && !deviceBrands.includes(item.vendor)) {
                    vendor = item.vendor;
                } else if (item.company && !deviceBrands.includes(item.company)) {
                    vendor = item.company;
                } else {
                    vendor = '未识别'; // 供应商未识别
                }
                
                // 识别制造商
                if (deviceBrands.includes(item.supplier)) {
                    manufacturer = item.supplier;
                } else if (deviceBrands.includes(item.vendor)) {
                    manufacturer = item.vendor;
                } else if (item.manufacturer) {
                    manufacturer = item.manufacturer;
                } else if (deviceBrands.includes(item.brand)) {
                    manufacturer = item.brand;
                }
                
                const formatted = {
                    id: `analyzed-${index}`,
                    productName: productName,
                    vendor: vendor,
                    category: item.quotationCategory || item.category || item.product_category || item.type || '其他',
                    region: item.region || item.location || undefined,
                    productSpec: item.detailedComponents || item.productSpec || item.configDetail || 
                                item.specifications || item.description || item.model || item.sku || '',
                    // 价格处理 - 直接使用识别的值，不计算
                    originalPrice: listPrice,
                    unitPrice: unitPrice,
                    finalPrice: finalPrice,
                    quantity: quantity,
                    // 折扣率 - 只使用明确标注的值，不计算
                    discount: item.discount_rate ? item.discount_rate / 100 : 
                             item.discount_percent ? item.discount_percent / 100 : 
                             item.discount ? item.discount : undefined,
                    quotationDate: item.quote_validity || item.quoteDate || item.validityDate || item.date ? 
                                  new Date(item.quote_validity || item.quoteDate || item.validityDate || item.date).toISOString().split('T')[0] : '',
                    // 币种处理
                    currency: item.currency || item.curr || 'USD',
                    // 备注信息整合
                    remark: [
                        item.notes || '',
                        manufacturer ? `制造商: ${manufacturer}` : '',
                        item.sku ? `SKU: ${item.sku}` : '',
                        item.partNumber ? `型号: ${item.partNumber}` : '',
                        item.shipping_cost ? `运费: ${item.shipping_cost}` : '',
                        item.tax_amount ? `税费: ${item.tax_amount}` : '',
                        item.service_fee ? `服务费: ${item.service_fee}` : ''
                    ].filter(Boolean).join(' | '),
                    status: 'pending' as const,
                    originalFile: item.originalFile || null
                };
                
                // 调试：输出每条转换后的数据
                if (index < 3 || index === productsData.length - 1) {
                    console.log(`📋 第${index + 1}条转换后数据:`, formatted);
                    console.log(`📝 产品名称: ${productName}`);
                    console.log(`💰 价格信息: List Price=${listPrice}, 设备单价=${unitPrice}, 折后总价=${finalPrice}, 数量=${quantity}`);
                    console.log(`🏢 供应商信息: 供应商=${vendor}, 制造商=${manufacturer}`);
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
            
            // 清除超时定时器
            if (timeoutId) clearTimeout(timeoutId);
            
            // 检查是否是超时错误
            if (error instanceof Error && error.name === 'AbortError') {
                Toast.error('AI分析超时（6分钟），请尝试分析较小的文件或稍后重试');
            } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
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
                list_price: item.originalPrice || undefined,
                unit_price: item.unitPrice || undefined,
                quote_unit_price: item.unitPrice || (item.finalPrice && item.quantity ? Math.round((item.finalPrice / item.quantity) * 100) / 100 : item.finalPrice),
                quantity: item.quantity || 1,
                quote_total_price: item.finalPrice,
                totalPrice: item.originalPrice || item.finalPrice,
                discountedTotalPrice: item.finalPrice,
                unitPrice: item.unitPrice,
                quote_validity: item.quotationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                currency: item.currency || 'CNY',
                notes: item.remark || '',
                configDetail: item.productSpec || '',
                category: item.category || '其他',
                region: item.region || undefined,
                status: 'active',
                ...(item.originalFile ? { originalFile: item.originalFile } : {})
            }));

            console.log('🔄 使用AI服务器保存数据:', productsData.length, '条记录');
            console.log('📁 文件信息:', uploadedFile);

            // 调用API服务器的确认保存API
            const apiServerUrl = process.env.REACT_APP_API_SERVER_URL || 'http://localhost:3001';
            const response = await fetch(`${apiServerUrl}/api/quotations/confirm-save`, {
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
                Toast.error('无法连接到API服务器，请确保服务器正在运行 (端口3001)');
            } else if (error instanceof Error && error.message.includes('ERR_CONNECTION_REFUSED')) {
                Toast.error('连接被拒绝，请检查API服务器状态');
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
                list_price: values.originalPrice || undefined,
                unit_price: values.unitPrice || undefined,
                quote_unit_price: values.unitPrice || (values.finalPrice && values.quantity ? Math.round((values.finalPrice / values.quantity) * 100) / 100 : values.finalPrice),
                quantity: values.quantity || 1,
                quote_total_price: values.finalPrice,
                totalPrice: values.originalPrice || values.finalPrice,
                discountedTotalPrice: values.finalPrice,
                unitPrice: values.unitPrice,
                quote_validity: values.quotationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                currency: values.currency || 'CNY',
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

    // 显示文件已存在对话框
    const showFileExistsDialog = (result: any) => {
        console.log('🔔 showFileExistsDialog被调用');
        console.log('📋 接收到的result:', result);
        
        setExistingFileInfo(result);
        setFileExistsDialogVisible(true);
        
        console.log('✅ 文件重复对话框状态已设置完成');
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
            const apiServerUrl = process.env.REACT_APP_API_SERVER_URL || 'http://localhost:3001';
            console.log('🌐 API服务器地址:', apiServerUrl);
            
            const response = await fetch(`${apiServerUrl}/api/quotations/confirm-save`, {
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
                Toast.error('无法连接到API服务器，请确保服务器正在运行 (端口3001)');
            } else if (error instanceof Error && error.message.includes('ERR_CONNECTION_REFUSED')) {
                Toast.error('连接被拒绝，请检查API服务器状态');
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
                            <Title heading={4} style={{ color: 'var(--semi-color-success)', marginBottom: '16px' }}>
                                文件上传成功
                            </Title>
                            
                            <div style={{ marginBottom: '24px', color: 'var(--semi-color-text-1)' }}>
                                <Text>文件名：{uploadedFile?.fileName}</Text><br />
                                <Text>文件大小：{uploadedFile ? (uploadedFile.size / 1024).toFixed(2) : 0} KB</Text><br />
                                <Text>上传时间：{uploadedFile ? new Date(uploadedFile.uploadTime).toLocaleString() : ''}</Text>
                            </div>
                            
                            {/* AI识别设置 */}
                            <div style={{ 
                                marginBottom: '24px', 
                                padding: '16px', 
                                border: '1px solid var(--semi-color-border)', 
                                borderRadius: '8px',
                                backgroundColor: 'var(--semi-color-bg-1)'
                            }}>
                                <Title heading={6} style={{ marginBottom: '12px' }}>AI识别设置</Title>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Switch 
                                        checked={enableDetailedAI}
                                        onChange={(checked: boolean) => setEnableDetailedAI(checked)}
                                        size="large"
                                    />
                                    <div>
                                        <Text strong>启用AI详细配置识别</Text>
                                        <br />
                                        <Text type="secondary" size="small">
                                            {enableDetailedAI ? 
                                                '将进行基础信息识别 + 详细配置标注分析（慎用，当前版本识别效果很烂）' : 
                                                '仅进行基础信息识别（产品名称、供应商、价格等）'
                                            }
                                        </Text>
                                    </div>
                                </div>
                            </div>
                            
                            <Button
                                type="primary"
                                onClick={handleAnalyze}
                                loading={analyzing}
                                size="large"
                            >
                                {analyzing ? '正在分析...' : '开始AI分析'}
                            </Button>
                            
                            {analyzing && (
                                <div style={{ marginTop: '20px' }}>
                                    <Text>正在使用AI大模型分析报价单内容，请稍候...</Text>
                                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--semi-color-text-2)' }}>
                                        <div> 提取表格数据...</div>
                                        <div> 检测并识别图片内容 (OCR)...</div>
                                        <div> AI智能分析中...</div>
                                    </div>
                                    <Progress percent={-1} style={{ marginTop: '12px' }} />
                                </div>
                            )}
                        </div>
                    </Card>
                );

            case 2:
                console.log('🎨 渲染第2步 - 数据确认页面');
                console.log('📊 analyzedData:', analyzedData);
                console.log('📍 currentIndex:', currentIndex);
                
                if (!analyzedData || analyzedData.length === 0) {
                    console.warn('⚠️ analyzedData为空，返回到第1步');
                    return (
                        <Card style={{ marginTop: '20px' }}>
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <Title heading={4} style={{ color: 'var(--semi-color-warning)' }}>
                                    没有分析数据
                                </Title>
                                <Text style={{ marginBottom: '20px', display: 'block' }}>
                                    请重新进行AI分析
                                </Text>
                                <Button type="primary" onClick={() => setCurrentStep(1)}>
                                    返回分析
                                </Button>
                            </div>
                        </Card>
                    );
                }
                
                const currentData = analyzedData[currentIndex];
                console.log('📋 当前数据:', currentData);
                
                if (!currentData) {
                    console.warn('⚠️ 当前数据为空，重置索引');
                    setCurrentIndex(0);
                    return (
                        <Card style={{ marginTop: '20px' }}>
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <Title heading={4} style={{ color: 'var(--semi-color-warning)' }}>
                                    数据加载中...
                                </Title>
                            </div>
                        </Card>
                    );
                }
                
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

                        {/* AI识别结果展示 */}
                        {currentData && (
                            <Card 
                                style={{ 
                                    marginBottom: '20px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                <Title heading={4} style={{ color: 'white', marginBottom: '20px' }}>
                                    AI识别结果
                                </Title>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                    {/* 基本信息 */}
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.1)', 
                                        padding: '16px', 
                                        borderRadius: '8px',
                                        backdropFilter: 'blur(10px)'
                                    }}>
                                        <Title heading={6} style={{ color: 'white', marginBottom: '12px' }}>基本信息</Title>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>产品名称:</Text>
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{currentData.productName || '未识别'}</Text>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>供应商:</Text>
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{currentData.vendor || '未识别'}</Text>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>产品类别:</Text>
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{currentData.category || '其他'}</Text>
                                            </div>
                                            {currentData.region && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>地区:</Text>
                                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>{currentData.region}</Text>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 价格信息 */}
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.1)', 
                                        padding: '16px', 
                                        borderRadius: '8px',
                                        backdropFilter: 'blur(10px)'
                                    }}>
                                        <Title heading={6} style={{ color: 'white', marginBottom: '12px' }}>价格信息</Title>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {currentData.currency && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>币种:</Text>
                                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                                        {CURRENCIES.find(c => c.value === currentCurrency)?.label || currentData.currency}
                                                    </Text>
                                                </div>
                                            )}
                                            {currentData.originalPrice && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>List Price:</Text>
                                                                                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                                    {currentCurrency || 'CNY'} {currentData.originalPrice.toLocaleString()}
                                                </Text>
                                                </div>
                                            )}
                                            {currentData.unitPrice && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>设备单价:</Text>
                                                    <Text style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '16px' }}>
                                                        {currentCurrency || 'CNY'} {currentData.unitPrice.toLocaleString()}
                                                    </Text>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>折后总价:</Text>
                                                <Text style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '18px' }}>
                                                    {currentCurrency || 'CNY'} {currentData.finalPrice.toLocaleString()}
                                                </Text>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>数量:</Text>
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{currentData.quantity || 1}</Text>
                                            </div>
                                            {currentData.discount && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>折扣率:</Text>
                                                    <Text style={{ color: '#f87171', fontWeight: 'bold' }}>{(currentData.discount * 100).toFixed(1)}%</Text>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 详细信息 */}
                                    <div style={{ 
                                        background: 'rgba(255, 255, 255, 0.1)', 
                                        padding: '16px', 
                                        borderRadius: '8px',
                                        backdropFilter: 'blur(10px)',
                                        gridColumn: 'span 2'
                                    }}>
                                        <Title heading={6} style={{ color: 'white', marginBottom: '12px' }}>详细信息</Title>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                                            {currentData.productSpec && (
                                                <div>
                                                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '4px' }}>产品规格:</Text>
                                                    <div style={{ 
                                                        color: 'white',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word',
                                                        lineHeight: '1.5'
                                                    }}>
                                                        {(() => {
                                                            const content = currentData.productSpec;
                                                            // 首先处理转义的\n字符，然后处理其他分隔符
                                                            return content
                                                                .replace(/\\n/g, '\n')  // 🔥 关键修复：将\n转换为实际换行
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
                                            )}
                                            {currentData.quotationDate && (
                                                <div>
                                                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '4px' }}>报价日期:</Text>
                                                    <Text style={{ color: 'white' }}>{currentData.quotationDate}</Text>
                                                </div>
                                            )}
                                            {currentData.remark && (
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '4px' }}>备注:</Text>
                                                    <div style={{ 
                                                        color: 'white',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word',
                                                        lineHeight: '1.5'
                                                    }}>
                                                        {(() => {
                                                            const content = currentData.remark;
                                                            // 首先处理转义的\n字符，然后处理其他分隔符
                                                            return content
                                                                .replace(/\\n/g, '\n')  // 🔥 关键修复：将\n转换为实际换行
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
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        )}

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
                                            onClick={handleEditCurrent}
                                            disabled={currentData?.status === 'editing'}
                                        >
                                            编辑
                                        </Button>
                                        <Button 
                                            type="danger" 
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
                                        label="List Price"
                                        placeholder="请输入List Price"
                                        disabled={currentData?.status !== 'editing'}
                                        formatter={value => {
                                            const currencyCode = currentCurrency || 'CNY';
                                            return `${currencyCode} ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                                        }}
                                        parser={value => value!.replace(/[^\d.]/g, '')}
                                    />
                                    <Form.InputNumber
                                        field="unitPrice"
                                        label="设备单价（如有）"
                                        placeholder="请输入设备单价"
                                        disabled={currentData?.status !== 'editing'}
                                        formatter={value => {
                                            const currencyCode = currentCurrency || 'CNY';
                                            return `${currencyCode} ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                                        }}
                                        parser={value => value!.replace(/[^\d.]/g, '')}
                                    />
                                    <Form.InputNumber
                                        field="finalPrice"
                                        label="折后总价（到手价）"
                                        placeholder="请输入折后总价"
                                        rules={[{ required: true, message: '请输入折后总价' }]}
                                        disabled={currentData?.status !== 'editing'}
                                        formatter={value => {
                                            const currencyCode = currentCurrency || 'CNY';
                                            return `${currencyCode} ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                                        }}
                                        parser={value => value!.replace(/[^\d.]/g, '')}
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
                                    <Form.Select
                                        field="currency"
                                        label="币种"
                                        placeholder="请选择币种"
                                        disabled={currentData?.status !== 'editing'}
                                        optionList={CURRENCIES.map(currency => ({
                                            label: currency.label,
                                            value: currency.value
                                        }))}
                                        onChange={(value) => setCurrentCurrency(value as string)}
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
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                                {/* 上一条和下一条按钮 */}
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
                                
                                {/* 确认和保存按钮 */}
                                <Space>
                                    <Button 
                                        type="primary" 
                                        onClick={() => handleConfirmCurrent()}
                                        disabled={currentData?.status === 'confirmed'}
                                        size="large"
                                    >
                                        确认当前数据
                                    </Button>
                                    <Button 
                                        type="primary" 
                                        size="large"
                                        loading={saving}
                                        onClick={handleSaveAll}
                                        disabled={confirmedCount === 0}
                                    >
                                        保存全部已确认数据 ({confirmedCount})
                                    </Button>
                                </Space>
                            </div>
                        </Card>
                    </div>
                );

            case 3:
                return (
                    <Card style={{ marginTop: '20px' }}>
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
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
                style={{ top: '10vh', left: '5vw' }}
                centered={false}
            >
                <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
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
                    {pendingProducts && pendingProducts.length > 0 && (
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
                    )}
                </div>

                {/* 操作按钮 */}
                <div style={{ marginTop: '20px', textAlign: 'right' }}>
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

    // 渲染文件已存在对话框
    const renderFileExistsDialog = () => {
        if (!fileExistsDialogVisible || !existingFileInfo) {
            return null;
        }

        const { existingRecord, allRecords } = existingFileInfo;
        
        // 格式化价格显示
        const formatPrice = (price: number, currency: string = 'CNY') => {
            if (!price) return '-';
            const currencySymbols: Record<string, string> = {
                'CNY': '¥',
                'USD': '$',
                'EUR': '€',
                'GBP': '£',
                'JPY': '¥',
                'KRW': '₩',
                'INR': '₹',
                'CAD': 'C$',
                'AUD': 'A$',
                'CHF': 'CHF'
            };
            const symbol = currencySymbols[currency] || currency;
            return `${symbol}${price.toLocaleString()}`;
        };

        return (
            <Modal
                title="文件已被上传过"
                visible={fileExistsDialogVisible}
                onCancel={() => {
                    setFileExistsDialogVisible(false);
                    setExistingFileInfo(null);
                    Toast.info('已取消，您可以重新上传其他文件');
                }}
                footer={null}
                width={900}
                style={{ top: '5vh' }}
                bodyStyle={{ maxHeight: '80vh', overflow: 'auto' }}
            >
                <div>
                    {/* 文件信息提示 */}
                    <Card style={{ marginBottom: '20px', background: 'var(--semi-color-warning-light-default)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                            <IconAlertTriangle size="large" style={{ color: 'var(--semi-color-warning-6)', marginRight: '12px' }} />
                            <div>
                                <Title heading={4} style={{ margin: 0, color: 'var(--semi-color-warning-6)' }}>
                                    该文件已被上传过
                                </Title>
                                <Text type="secondary" style={{ marginTop: '4px' }}>
                                    系统检测到相同的文件已存在于数据库中
                                </Text>
                            </div>
                        </div>
                        
                        <Descriptions 
                            data={[
                                { key: '文件名', value: existingRecord.fileName },
                                { key: '首次上传时间', value: new Date(existingRecord.uploadDate).toLocaleString() },
                                { key: '状态', value: existingRecord.status === 'active' ? '有效' : '已失效' }
                            ]}
                            row
                            size="small"
                        />
                    </Card>

                    {/* 历史记录详情 */}
                    <Card>
                        <Title heading={5} style={{ marginBottom: '16px' }}>
                            历史记录详情 ({allRecords?.length || 1} 条记录)
                        </Title>
                        
                        {allRecords && allRecords.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {allRecords.map((record: any, index: number) => (
                                    <Card 
                                        key={record.id} 
                                        style={{ 
                                            border: '1px solid var(--semi-color-border)',
                                            background: index === 0 ? 'var(--semi-color-fill-0)' : 'white'
                                        }}
                                    >
                                        <div style={{ marginBottom: '12px' }}>
                                            <Title heading={6} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>
                                                {record.productName}
                                                {index === 0 && (
                                                    <Badge count="最新" type="primary" style={{ marginLeft: '8px' }} />
                                                )}
                                            </Title>
                                        </div>
                                        
                                        <Descriptions 
                                            data={[
                                                { key: '供应商', value: record.supplier || '-' },
                                                { key: '产品类别', value: record.category || '-' },
                                                { key: '地区', value: record.region || '-' },
                                                { key: '数量', value: record.quantity ? `${record.quantity} 个` : '-' },
                                                { key: '折扣前总价', value: formatPrice(record.totalPrice, record.currency) },
                                                { key: '折扣后总价', value: formatPrice(record.discountedTotalPrice, record.currency) },
                                                { key: '设备单价', value: formatPrice(record.unitPrice, record.currency) },
                                                { key: '报价有效期', value: record.quote_validity ? new Date(record.quote_validity).toLocaleDateString() : '-' },
                                                { key: '上传时间', value: new Date(record.uploadDate).toLocaleString() }
                                            ]}
                                            row
                                            size="small"
                                        />
                                        
                                        {/* 详细配置信息 */}
                                        {(record.detailedComponents || record.configDetail || record.notes) && (
                                            <div style={{ marginTop: '12px' }}>
                                                <Text strong style={{ fontSize: '13px' }}>详细信息：</Text>
                                                <div style={{
                                                    marginTop: '8px',
                                                    padding: '12px',
                                                    background: 'var(--semi-color-fill-1)',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    lineHeight: '1.6',
                                                    maxHeight: '200px',
                                                    overflow: 'auto',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}>
                                                    {(() => {
                                                        const content = record.detailedComponents || record.configDetail || record.notes || '暂无详细信息';
                                                        // 处理分行显示：将逗号、分号、管道符等替换为换行
                                                        return content
                                                            .replace(/,\s*/g, ',\n')  // 逗号后换行
                                                            .replace(/;\s*/g, ';\n')  // 分号后换行
                                                            .replace(/\|\s*/g, '|\n') // 管道符后换行
                                                            .replace(/，\s*/g, '，\n') // 中文逗号后换行
                                                            .replace(/；\s*/g, '；\n') // 中文分号后换行
                                                            .replace(/\n\s*\n/g, '\n') // 去除多余空行
                                                            .trim();
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                <Text type="secondary">暂无详细记录</Text>
                            </div>
                        )}
                    </Card>
                </div>

                {/* 操作按钮 */}
                <div style={{ marginTop: '24px', textAlign: 'right' }}>
                    <Space>
                        <Button 
                            type="tertiary"
                            onClick={() => {
                                setFileExistsDialogVisible(false);
                                setExistingFileInfo(null);
                                // 重置到第一步，允许用户重新上传
                                handleRestart();
                                Toast.info('已重置，您可以上传其他文件');
                            }}
                        >
                            重新上传其他文件
                        </Button>
                        <Button 
                            type="primary"
                            onClick={() => {
                                setFileExistsDialogVisible(false);
                                setExistingFileInfo(null);
                                Toast.info('已关闭，您可以查看历史记录或上传新文件');
                            }}
                        >
                            知道了
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
            
            {/* 文件已存在对话框 */}
            {renderFileExistsDialog()}
            
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
                            label="List Price"
                            placeholder="请输入List Price"
                            formatter={value => {
                                const currencyCode = currentCurrency || 'CNY';
                                return `${currencyCode} ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                            }}
                            parser={value => value!.replace(/[^\d.]/g, '')}
                        />
                        <Form.InputNumber
                            field="unitPrice"
                            label="设备单价（如有）"
                            placeholder="请输入设备单价"
                            formatter={value => {
                                const currencyCode = currentCurrency || 'CNY';
                                return `${currencyCode} ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                            }}
                            parser={value => value!.replace(/[^\d.]/g, '')}
                        />
                        <Form.InputNumber
                            field="finalPrice"
                            label="折后总价（到手价）"
                            placeholder="请输入折后总价"
                            rules={[{ required: true, message: '请输入折后总价' }]}
                            formatter={value => {
                                const currencyCode = currentCurrency || 'CNY';
                                return `${currencyCode} ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                            }}
                            parser={value => value!.replace(/[^\d.]/g, '')}
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
                        <Form.Select
                            field="currency"
                            label="币种"
                            placeholder="请选择币种"
                            optionList={CURRENCIES.map(currency => ({
                                label: currency.label,
                                value: currency.value
                            }))}
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
            
            {/* 底部留白 */}
            <div style={{ height: '200px' }}></div>
        </div>
    );
};

export default QuotationImport; 