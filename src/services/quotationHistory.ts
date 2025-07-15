import { request } from '../utils/request';
import { API_CONFIG } from '../utils/config';

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
    quote_validity: string | Date | null;    // 报价有效期
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
    wonBid?: boolean;
    
    // 新增字段以修复TypeScript错误
    totalPrice?: number;              // 总价
    discountedTotalPrice?: number;    // 折扣后总价
    unitPrice?: number;               // 单价
    detailedComponents?: string;      // 详细配件清单
    quotationTitle?: string;          // 报价单标题
    quotationCategory?: string;       // 报价单类别
    projectDescription?: string;      // 项目描述
    unit_price?: number;              // 单价（向后兼容）
    
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
    wonBid?: boolean;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
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

// 地区选项 - 仅EMEA地区
export const REGIONS = [
    '英国', '德国', '法国', '荷兰', '瑞典', '芬兰', '瑞士', '以色列', '其他'
];

// 获取历史报价列表（连接到AI服务器的MongoDB数据）
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
        if (params.wonBid !== undefined) apiParams.wonBid = params.wonBid;

        // 排序字段
        if (params.sortField) {
            apiParams.sortField = params.sortField === 'vendor' ? 'supplier' : params.sortField;
        }
        if (params.sortOrder) apiParams.sortOrder = params.sortOrder;

        // 连接到API服务器获取数据
        const apiServerUrl = API_CONFIG.API_URL;
        const response = await fetch(`${apiServerUrl}/api/quotations/list?${new URLSearchParams(apiParams).toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();

        // 数据格式转换，保持向后兼容
        const rawData = result.data || result;
        const convertedData = Array.isArray(rawData) ? rawData.map(item => ({
            ...item,
            id: item._id || item.id,
            // 基本信息转换
            productName: item.quotationTitle || item.productName || item.name,
            quotationTitle: item.quotationTitle,
            quotationCategory: item.quotationCategory,
            vendor: item.supplier,
            // 价格信息转换 - 优先使用新字段
            totalPrice: item.totalPrice || item.quote_total_price,
            discountedTotalPrice: item.discountedTotalPrice,
            unitPrice: item.unitPrice || item.unit_price,
            originalPrice: item.list_price || item.totalPrice,
            finalPrice: item.discountedTotalPrice || item.totalPrice || item.quote_unit_price,
            discount: item.discount_rate ? item.discount_rate / 100 : null,
            // 详细信息转换
            detailedComponents: item.detailedComponents,
            projectDescription: item.projectDescription,
            productSpec: item.productSpec || item.configDetail || item.detailedComponents,
            // 时间转换
            quotationDate: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : 
                          item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : '',
            isValid: item.status === 'active',
            remark: item.notes
        })) : [];

        return {
            data: convertedData,
            total: result.total || convertedData.length
        };
    } catch (error) {
        console.error('获取历史报价列表失败:', error);
        throw error;
    }
}

// 获取单个报价详情
export async function getQuotationDetail(id: string): Promise<QuotationRecord> {
    try {
        // 连接到API服务器获取数据
        const apiServerUrl = API_CONFIG.API_URL;
        const response = await fetch(`${apiServerUrl}/api/quotations/${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();

        // 数据格式转换，保持向后兼容
        const convertedData = {
            ...result.data,
            id: result.data._id || result.data.id,
            vendor: result.data.supplier,
            originalPrice: result.data.list_price,
            finalPrice: result.data.quote_unit_price,
            discount: result.data.discount_rate ? result.data.discount_rate / 100 : null,
            quotationDate: result.data.created_at ? new Date(result.data.created_at).toISOString().split('T')[0] : 
                          result.data.createdAt ? new Date(result.data.createdAt).toISOString().split('T')[0] : '',
            isValid: result.data.status === 'active',
            remark: result.data.notes,
            productSpec: result.data.configDetail || result.data.productSpec
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
            url = `${API_CONFIG.API_URL}/api/quotations/attachment/${quotationId}/${attachmentId}`;
        } else {
            // 通用附件下载
            url = `${API_CONFIG.API_URL}/api/attachments/${attachmentId}`;
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

// Mock数据已移除 - 现在只使用真实数据库数据

// 向后兼容的简化接口
export async function getQuotationListLegacy(params: QuotationQueryParams): Promise<QuotationRecord[]> {
    const response = await getQuotationList(params);
    return response.data;
} 