import { request } from '../utils/request';

// API 接口地址常量
const API_ENDPOINTS = {
    QUOTATION_LIST: '/api/quotations',
    QUOTATION_DETAIL: '/api/quotations/:id',
    QUOTATION_CREATE: '/api/quotations',
    QUOTATION_UPDATE: '/api/quotations/:id',
    QUOTATION_DELETE: '/api/quotations/:id',
    ATTACHMENT_DOWNLOAD: '/api/attachments/:id',
};

// 使用统一的QuotationRecord接口（与quotation.ts保持一致）
export interface QuotationRecord {
    _id?: string;
    id?: string | number;
    productName: string;              // 产品名称
    name?: string;                    // 向后兼容
    supplier: string;                 // 供应商
    vendor?: string;                  // 向后兼容字段
    list_price?: number | null;       // List Price / originalPrice
    originalPrice?: number;           // 向后兼容
    quote_unit_price: number;         // 报价单价 / finalPrice
    finalPrice?: number;              // 向后兼容
    quantity: number;                 // 数量
    discount_rate?: number | null;    // 折扣率
    discount?: number;                // 向后兼容
    quote_total_price: number;        // 报价总价
    quote_validity: string | Date;    // 报价有效期
    quotationDate?: string;           // 向后兼容
    delivery_date?: string | Date;    // 交付日期
    currency: string;                 // 币种
    notes?: string | null;            // 备注
    remark?: string;                  // 向后兼容
    configDetail?: string;            // 配置详情
    productSpec?: string;             // 产品规格
    category?: string;                // 产品类别
    region?: string;                  // 区域
    status?: 'active' | 'expired' | 'pending' | 'cancelled';
    isValid?: boolean;                // 向后兼容
    endUser?: {                       // 最终用户信息
        name?: string;
        address?: string;
        contact?: string;
        contactInfo?: string;
    };
    attachments?: Array<{             // 附件信息
        id: string;
        name: string;
        originalName?: string;
        filename?: string;
        path?: string;
        url?: string;                 // 向后兼容
        size?: number;
        mimetype?: string;
        uploadedAt?: Date;
    }>;
    originalFile?: {                  // 原始文件信息
        filename: string;
        originalName: string;
        path: string;
        uploadedAt: Date;
    };
    createdAt?: string | Date;
    updatedAt?: string | Date;
}

// 定义查询参数接口（与后端API保持一致）
export interface QuotationQueryParams {
    page?: number;
    pageSize?: number;
    supplier?: string;
    vendor?: string;                  // 向后兼容
    productName?: string;
    productType?: string;             // 向后兼容
    productKeyword?: string;
    category?: string;
    region?: string;
    currency?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
}

// 响应接口
export interface QuotationResponse {
    success: boolean;
    data: QuotationRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// Mock产品类别（保持向后兼容）
export const PRODUCT_CATEGORIES = [
    '服务器',
    '存储设备',
    '网络设备',
    '安全设备',
    '软件系统',
    '云服务',
    '其他'
] as const;

// Mock地区（保持向后兼容）
export const REGIONS = [
    '德国',
    '法国', 
    '英国',
    '意大利',
    '西班牙',
    '荷兰',
    '比利时',
    '瑞士',
    '奥地利',
    '瑞典',
    '挪威',
    '丹麦',
    '芬兰',
    '波兰',
    '捷克',
    '匈牙利',
    '葡萄牙',
    '爱尔兰',
    '希腊',
    '美国',
    '加拿大',
    '其他'
] as const;

// 获取历史报价列表（连接到真实MongoDB后端）
export async function getQuotationList(params: QuotationQueryParams): Promise<{ data: QuotationRecord[]; total: number }> {
    try {
        // 处理向后兼容的参数映射
        const apiParams: any = {
            page: params.page || 1,
            pageSize: params.pageSize || 10
        };

        if (params.supplier || params.vendor) {
            apiParams.supplier = params.supplier || params.vendor;
        }
        if (params.productName) apiParams.productName = params.productName;
        if (params.category || params.productType) {
            apiParams.category = params.category || params.productType;
        }
        if (params.region) apiParams.region = params.region;
        if (params.currency) apiParams.currency = params.currency;
        if (params.status) apiParams.status = params.status;
        if (params.startDate) apiParams.startDate = params.startDate;
        if (params.endDate) apiParams.endDate = params.endDate;
        if (params.keyword || params.productKeyword) {
            apiParams.keyword = params.keyword || params.productKeyword;
        }

        const response: any = await request('/products', {
            method: 'GET',
            params: apiParams
        });

        // 数据格式转换，保持向后兼容
        const rawData = response.data || response; // 兼容不同的响应格式
        const convertedData = (Array.isArray(rawData) ? rawData : []).map((item: any) => ({
            ...item,
            id: item._id || item.id,
            vendor: item.supplier,           // 向后兼容
            originalPrice: item.list_price,  // 向后兼容
            finalPrice: item.quote_unit_price, // 向后兼容
            discount: item.discount_rate ? item.discount_rate / 100 : null, // 转换为小数
            quotationDate: item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : '',
            isValid: item.status === 'active',
            remark: item.notes,
            productSpec: item.configDetail || item.productSpec
        }));

        return {
            data: convertedData,
            total: response.total || rawData.length || 0
        };
    } catch (error) {
        console.error('获取历史报价列表失败:', error);
        throw error;
    }
}

// 获取单个报价详情
export async function getQuotationDetail(id: string): Promise<QuotationRecord> {
    try {
        const response: any = await request(`/products/${id}`, {
            method: 'GET'
        });

        // 数据格式转换，保持向后兼容
        const convertedData = {
            ...response.data,
            id: response.data._id || response.data.id,
            vendor: response.data.supplier,
            originalPrice: response.data.list_price,
            finalPrice: response.data.quote_unit_price,
            discount: response.data.discount_rate ? response.data.discount_rate / 100 : null,
            quotationDate: response.data.createdAt ? new Date(response.data.createdAt).toISOString().split('T')[0] : '',
            isValid: response.data.status === 'active',
            remark: response.data.notes,
            productSpec: response.data.configDetail || response.data.productSpec
        };

        return convertedData;
    } catch (error) {
        console.error('获取报价详情失败:', error);
        throw error;
    }
}

// 创建新报价
export async function createQuotation(data: Omit<QuotationRecord, '_id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }> {
    try {
        // 数据格式转换
        const apiData = {
            productName: data.productName,
            name: data.productName, // 向后兼容
            supplier: data.supplier || data.vendor,
            list_price: data.list_price || data.originalPrice,
            quote_unit_price: data.quote_unit_price || data.finalPrice,
            quantity: data.quantity,
            discount_rate: data.discount_rate || (data.discount ? data.discount * 100 : null),
            quote_total_price: data.quote_total_price || (data.finalPrice ? data.finalPrice * data.quantity : 0),
            quote_validity: data.quote_validity,
            delivery_date: data.delivery_date,
            currency: data.currency || 'EUR',
            notes: data.notes || data.remark,
            configDetail: data.configDetail || data.productSpec,
            category: data.category,
            region: data.region,
            status: data.status || (data.isValid ? 'active' : 'inactive'),
            endUser: data.endUser,
            attachments: data.attachments
        };

        const response: any = await request('/products', {
            method: 'POST',
            data: apiData
        });

        return { id: response.id || response.data?._id };
    } catch (error) {
        console.error('创建报价失败:', error);
        throw error;
    }
}

// 更新报价
export async function updateQuotation(id: string, data: Partial<QuotationRecord>): Promise<{ success: boolean }> {
    try {
        // 数据格式转换
        const apiData: any = {};
        
        if (data.productName) apiData.productName = data.productName;
        if (data.supplier || data.vendor) apiData.supplier = data.supplier || data.vendor;
        if (data.list_price !== undefined || data.originalPrice !== undefined) {
            apiData.list_price = data.list_price ?? data.originalPrice;
        }
        if (data.quote_unit_price !== undefined || data.finalPrice !== undefined) {
            apiData.quote_unit_price = data.quote_unit_price ?? data.finalPrice;
        }
        if (data.quantity !== undefined) apiData.quantity = data.quantity;
        if (data.discount_rate !== undefined || data.discount !== undefined) {
            apiData.discount_rate = data.discount_rate ?? (data.discount ? data.discount * 100 : null);
        }
        if (data.quote_total_price !== undefined) apiData.quote_total_price = data.quote_total_price;
        if (data.quote_validity) apiData.quote_validity = data.quote_validity;
        if (data.delivery_date) apiData.delivery_date = data.delivery_date;
        if (data.currency) apiData.currency = data.currency;
        if (data.notes !== undefined || data.remark !== undefined) {
            apiData.notes = data.notes ?? data.remark;
        }
        if (data.configDetail !== undefined || data.productSpec !== undefined) {
            apiData.configDetail = data.configDetail ?? data.productSpec;
        }
        if (data.category) apiData.category = data.category;
        if (data.region) apiData.region = data.region;
        if (data.status !== undefined || data.isValid !== undefined) {
            apiData.status = data.status ?? (data.isValid ? 'active' : 'inactive');
        }
        if (data.endUser) apiData.endUser = data.endUser;
        if (data.attachments) apiData.attachments = data.attachments;

        const response: any = await request(`/products/${id}`, {
            method: 'PUT',
            data: apiData
        });

        return { success: response.success || true };
    } catch (error) {
        console.error('更新报价失败:', error);
        throw error;
    }
}

// 删除报价
export async function deleteQuotation(id: string): Promise<{ success: boolean }> {
    try {
        const response: any = await request(`/products/${id}`, {
            method: 'DELETE'
        });

        return { success: response.success || true };
    } catch (error) {
        console.error('删除报价失败:', error);
        throw error;
    }
}

// 下载附件
export async function downloadAttachment(attachmentId: string, quotationId?: string): Promise<Blob> {
    try {
        let url: string;
        
        if (quotationId) {
            // 新的API端点格式
            url = `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/quotations/attachment/${quotationId}/${attachmentId}`;
        } else {
            // 兼容旧格式
            url = `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/attachments/${attachmentId}`;
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('下载附件失败');
        }
        
        return await response.blob();
    } catch (error) {
        console.error('下载附件失败:', error);
        throw error;
    }
}

// 导出向后兼容的模拟数据（如果需要降级）
export const mockQuotations: QuotationRecord[] = [
    {
        id: '1',
        _id: '1',
        productName: '服务器Pro Max',
        category: '服务器',
        region: '德国',
        productSpec: 'CPU: 2.5GHz, 内存: 64GB, 硬盘: 2TB',
        configDetail: 'CPU: 2.5GHz, 内存: 64GB, 硬盘: 2TB',
        supplier: '联想',
        vendor: '联想',
        list_price: 45000,
        originalPrice: 45000,
        quote_unit_price: 42000,
        finalPrice: 42000,
        quantity: 10,
        quote_total_price: 420000,
        discount_rate: 7,
        discount: 0.93,
        currency: 'EUR',
        quote_validity: '2024-06-15',
        quotationDate: '2024-03-15',
        status: 'active',
        isValid: true,
        notes: '含三年原厂质保',
        remark: '含三年原厂质保'
    }
];

// 向后兼容的简化接口
export async function getQuotationListLegacy(params: QuotationQueryParams): Promise<QuotationRecord[]> {
    const response = await getQuotationList(params);
    return response.data;
} 