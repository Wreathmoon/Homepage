import { request } from '../utils/request';

// 产品类型
export const PRODUCT_CATEGORIES = [
    '服务器',
    '存储设备',
    '网络设备',
    '安全设备',
    '软件系统',
    '云服务',
    '其他'
] as const;

// 供应商区域
export const VENDOR_REGIONS = [
    '华北',
    '华东',
    '华南',
    '华中',
    '西南',
    '西北',
    '东北',
    '海外'
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
export type VendorRegion = typeof VENDOR_REGIONS[number];

// 供应商信息接口
export interface Vendor {
    _id?: string;
    id?: number;
    name: string;
    code: string;
    category: ProductCategory[];
    region: VendorRegion;
    contact: string;
    phone: string;
    email: string;
    address: string;
    status: 'active' | 'inactive';
    level: 'A' | 'B' | 'C';
    remarks?: string;
    type: 'HARDWARE' | 'SOFTWARE' | 'SERVICE';
    country: string;
    website?: string;
    brands: string[];
    isGeneralAgent: boolean;
    isAgent: boolean;
    account?: string;
    password?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface VendorQueryParams {
    name?: string;
    category?: ProductCategory;
    region?: VendorRegion;
    status?: 'active' | 'inactive';
    level?: 'A' | 'B' | 'C';
    type?: 'HARDWARE' | 'SOFTWARE' | 'SERVICE';
    country?: string;
    keyword?: string;
    productCategory?: string;
    productKeyword?: string;
    isGeneralAgent?: boolean;
    isAgent?: boolean;
    page?: number;
    pageSize?: number;
}

export interface VendorResponse {
    success: boolean;
    data: Vendor[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// API 函数
export async function getVendorList(params: VendorQueryParams): Promise<VendorResponse> {
    try {
        const response: any = await request('/vendors', {
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
        console.error('获取供应商列表失败:', error);
        throw error;
    }
}

// 根据ID获取供应商详情
export async function getVendorById(id: string): Promise<Vendor> {
    try {
        const response: any = await request(`/vendors/${id}`, {
            method: 'GET'
        });
        return response.data;
    } catch (error) {
        console.error('获取供应商详情失败:', error);
        throw error;
    }
}

// 添加新供应商
export async function addVendor(vendor: Omit<Vendor, '_id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Vendor> {
    try {
        const response: any = await request('/vendors', {
            method: 'POST',
            data: vendor
        });
        return response.data;
    } catch (error) {
        console.error('添加供应商失败:', error);
        throw error;
    }
}

// 更新供应商信息
export async function updateVendor(id: string, vendor: Partial<Vendor>): Promise<Vendor> {
    try {
        const response: any = await request(`/vendors/${id}`, {
            method: 'PUT',
            data: vendor
        });
        return response.data;
    } catch (error) {
        console.error('更新供应商失败:', error);
        throw error;
    }
}

// 删除供应商
export async function deleteVendor(id: string): Promise<void> {
    try {
        await request(`/vendors/${id}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('删除供应商失败:', error);
        throw error;
    }
}

// 获取供应商产品信息
export async function getVendorProducts(vendorId: number | string): Promise<{ data: any }> {
    try {
        const response: any = await request(`/vendors/${vendorId}/products`, {
            method: 'GET'
        });
        return response;
    } catch (error) {
        console.error('获取供应商产品失败:', error);
        throw error;
    }
}

// 批量导入供应商数据
export async function importVendors(vendors: Vendor[]): Promise<Vendor[]> {
    try {
        const response: any = await request('/vendors/batch-import', {
            method: 'POST',
            data: { vendors }
        });
        return response.data;
    } catch (error) {
        console.error('批量导入供应商失败:', error);
        throw error;
    }
}

// 供应商文件上传
export async function uploadVendorFile(file: File): Promise<{ message: string; data: Vendor[] }> {
    try {
        const formData = new FormData();
        formData.append('vendorFile', file);

        const response: any = await request('/upload/vendor', {
            method: 'POST',
            data: formData
        });

        return {
            message: response.message,
            data: response.data
        };
    } catch (error) {
        console.error('上传供应商文件失败:', error);
        throw error;
    }
}

// 兼容性：保留原有的模拟数据接口，用于降级处理
export const mockVendors: Vendor[] = [
    {
        id: 1,
        name: '北京科技有限公司',
        code: 'BJ001',
        category: ['服务器', '存储设备'],
        region: '华北',
        contact: '张三',
        phone: '13800138000',
        email: 'zhangsan@example.com',
        address: '北京市海淀区中关村科技园',
        status: 'active',
        level: 'A',
        remarks: '战略合作伙伴',
        type: 'HARDWARE',
        country: '中国',
        website: 'http://www.bjtech.com',
        brands: ['联想', '浪潮'],
        isGeneralAgent: true,
        isAgent: false,
        account: 'zhangsan',
        password: 'password123'
    },
    {
        id: 2,
        name: '上海网络科技公司',
        code: 'SH001',
        category: ['网络设备', '安全设备'],
        region: '华东',
        contact: '李四',
        phone: '13900139000',
        email: 'lisi@example.com',
        address: '上海市浦东新区张江高科技园区',
        status: 'active',
        level: 'B',
        type: 'HARDWARE',
        country: '中国',
        website: 'http://www.shnetwork.com',
        brands: ['华为', 'H3C'],
        isGeneralAgent: false,
        isAgent: true,
        account: 'lisi',
        password: 'password456'
    },
    {
        id: 3,
        name: 'American Software Solutions',
        code: 'US001',
        category: ['软件系统', '云服务'],
        region: '海外',
        contact: 'John Smith',
        phone: '+1-123-456-7890',
        email: 'john@example.com',
        address: '123 Tech Street, Silicon Valley',
        status: 'active',
        level: 'A',
        type: 'SOFTWARE',
        country: '美国',
        website: 'http://www.ussoftware.com',
        brands: ['Microsoft', 'Oracle'],
        isGeneralAgent: true,
        isAgent: false,
        account: 'john',
        password: 'password789'
    },
    {
        id: 4,
        name: '深圳智能科技有限公司',
        code: 'SZ001',
        category: ['安全设备', '网络设备'],
        region: '华南',
        contact: '王五',
        phone: '13700137000',
        email: 'wangwu@example.com',
        address: '深圳市南山区科技园',
        status: 'active',
        level: 'B',
        type: 'SERVICE',
        country: '中国',
        website: 'http://www.sztech.com',
        brands: ['深信服', '绿盟'],
        isGeneralAgent: false,
        isAgent: true,
        account: 'wangwu',
        password: 'password101'
    }
]; 