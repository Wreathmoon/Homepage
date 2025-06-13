import { request } from '../utils/request';

// 报价记录接口定义 (扩展以匹配MongoDB模型)
export interface QuotationRecord {
    _id?: string;
    id?: number;
    name?: string;                    // 产品名 (向后兼容)
    productName: string;              // 产品名称
    supplier: string;                 // 供应商
    list_price?: number | null;       // List Price
    quote_unit_price: number;         // 报价单价
    quantity: number;                 // 数量
    discount_rate?: number | null;    // 折扣率
    quote_total_price: number;        // 报价总价
    quote_validity: string | Date;    // 报价有效期
    delivery_date?: string | Date;    // 交付日期
    currency: string;                 // 币种
    notes?: string | null;            // 备注
    configDetail?: string;            // 配置详情
    productSpec?: string;             // 产品规格
    category?: string;                // 产品类别
    region?: string;                  // 区域
    status?: 'active' | 'expired' | 'pending' | 'cancelled';
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

// 查询参数接口
export interface QuotationQueryParams {
    page?: number;
    pageSize?: number;
    supplier?: string;
    productName?: string;
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

// 获取所有报价记录 (支持查询参数)
export async function getQuotationList(params?: QuotationQueryParams): Promise<QuotationResponse> {
    try {
        const response: any = await request('/products', {
            method: 'GET',
            params
        });

        return {
            success: response.success || true,
            data: response.data || [],
            total: response.total || 0,
            page: response.page || 1,
            pageSize: response.pageSize || 10,
            totalPages: response.totalPages || 0
        };
    } catch (error) {
        console.error('获取报价列表失败:', error);
        throw error;
    }
}

// 根据ID获取单个报价详情
export async function getQuotationById(id: string): Promise<QuotationRecord> {
    try {
        const response: any = await request(`/products/${id}`, {
            method: 'GET'
        });
        return response.data;
    } catch (error) {
        console.error('获取报价详情失败:', error);
        throw error;
    }
}

// 添加报价记录
export async function addQuotation(data: Omit<QuotationRecord, '_id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; id: string; data: QuotationRecord }> {
    try {
        const response: any = await request('/products', {
            method: 'POST',
            data
        });
        
        return {
            success: response.success || true,
            id: response.id || response.data?._id,
            data: response.data
        };
    } catch (error) {
        console.error('添加报价失败:', error);
        throw error;
    }
}

// 更新报价记录
export async function updateQuotation(id: string, data: Partial<QuotationRecord>): Promise<{ success: boolean; changes: number; data: QuotationRecord }> {
    try {
        const response: any = await request(`/products/${id}`, {
            method: 'PUT',
            data
        });
        
        return {
            success: response.success || true,
            changes: response.changes || 1,
            data: response.data
        };
    } catch (error) {
        console.error('更新报价失败:', error);
        throw error;
    }
}

// 删除报价记录
export async function deleteQuotation(id: string): Promise<{ success: boolean; changes: number }> {
    try {
        const response: any = await request(`/products/${id}`, {
            method: 'DELETE'
        });
        
        return {
            success: response.success || true,
            changes: response.changes || 1
        };
    } catch (error) {
        console.error('删除报价失败:', error);
        throw error;
    }
}

// 上传报价文件
export async function uploadQuotationFile(file: File): Promise<{ success: boolean; message: string; data?: QuotationRecord[] }> {
    try {
        const formData = new FormData();
        formData.append('quotationFile', file);

        // 修复URL路径问题 - 使用完整的URL而不是通过request实例
        const response = await fetch('http://localhost:3002/api/upload/quotation', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('服务器响应错误:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();

        return {
            success: result.success || true,
            message: result.message || '上传成功',
            data: result.data
        };
    } catch (error) {
        console.error('上传报价文件失败:', error);
        throw error;
    }
}

// 下载报价原始文件
export async function downloadQuotationFile(id: string): Promise<void> {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3002/api'}/quotations/download/${id}`);
        
        if (!response.ok) {
            throw new Error('下载失败');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // 从响应头获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let fileName = `报价单_${id}`;
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
    } catch (error) {
        console.error('下载文件失败:', error);
        throw error;
    }
}

// 获取报价统计信息
export async function getQuotationStats(): Promise<any> {
    try {
        const response: any = await request('/quotations/stats/overview', {
            method: 'GET'
        });
        return response.data;
    } catch (error) {
        console.error('获取统计信息失败:', error);
        throw error;
    }
}

// 向后兼容：保留原有接口的简化版本
export async function getQuotationListLegacy(): Promise<QuotationRecord[]> {
    const response = await getQuotationList();
    return response.data;
} 