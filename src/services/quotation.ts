import { request } from '../utils/request';

// 报价记录接口定义
export interface QuotationRecord {
    id: number;
    name: string;                 // 产品名
    supplier: string;             // 供应商
    list_price: number | null;    // List Price
    quote_unit_price: number;     // 报价单价
    quantity: number;             // 数量
    discount_rate: number | null; // 折扣率
    quote_total_price: number;    // 报价总价
    quote_validity: string;       // 报价有效期
    notes: string | null;         // 备注（包含详细配置信息）
}

// 获取所有报价记录
export async function getQuotationList(): Promise<QuotationRecord[]> {
    return request('/api/products');
}

// 添加报价记录
export async function addQuotation(data: Omit<QuotationRecord, 'id'>): Promise<{ id: number }> {
    return request('/api/products', {
        method: 'POST',
        data
    });
}

// 更新报价记录
export async function updateQuotation(id: number, data: Omit<QuotationRecord, 'id'>): Promise<{ changes: number }> {
    return request(`/api/products/${id}`, {
        method: 'PUT',
        data
    });
}

// 删除报价记录
export async function deleteQuotation(id: number): Promise<{ changes: number }> {
    return request(`/api/products/${id}`, {
        method: 'DELETE'
    });
}

// 上传报价文件
export async function uploadQuotationFile(file: File): Promise<{ message: string; data?: QuotationRecord[] }> {
    const formData = new FormData();
    formData.append('quotationFile', file);

    return request('/api/upload-quotation', {
        method: 'POST',
        body: formData
    });
} 