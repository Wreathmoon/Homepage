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

// 供应商区域 - 仅EMEA地区
export const VENDOR_REGIONS = [
    '英国', '德国', '法国', '荷兰', '瑞典', '芬兰', '瑞士', '以色列', '其他'
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
export type VendorRegion = typeof VENDOR_REGIONS[number];

// 联系人信息接口
export interface ContactInfo {
    name: string;
    phone: string;
    email: string;
    position?: string;
    remarks?: string;
    isPrimary?: boolean;
}

// 供应商信息接口
export interface Vendor {
    _id?: string;
    id?: number;
    name: string;
    code: string;
    category: ProductCategory[];
    region: VendorRegion;
    // 多个联系人信息
    contacts?: ContactInfo[];
    // 向后兼容字段
    contact: string;
    phone: string;
    email: string;
    address: string;
    status: 'active' | 'inactive';
    remarks?: string;
    type: 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'DATACENTER';
    website?: string;
    brands: string[];
    isGeneralAgent: boolean;
    isAgent: boolean;
    account?: string;
    password?: string;
    // 录入人和录入时间信息
    entryPerson?: string;
    entryTime?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface VendorQueryParams {
    name?: string;
    category?: ProductCategory;
    region?: VendorRegion;
    status?: 'active' | 'inactive';
    type?: 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'DATACENTER' | 'OTHER';
    keyword?: string;
    productCategory?: string;
    productKeyword?: string;
    agentType?: 'GENERAL_AGENT' | 'AGENT' | 'OTHER';
    // 保持向后兼容
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
        _id: '1',
        name: '联想（中国）',
        code: 'LENOVO_CN',
        category: ['服务器', '网络设备'],
        region: '其他',
        contact: '张经理',
        phone: '+86-10-1234-5678',
        email: 'zhang@lenovo.com',
        address: '北京市海淀区上地信息产业基地',
        status: 'active',
        type: 'HARDWARE',
        website: 'https://www.lenovo.com.cn',
        brands: ['ThinkPad', 'ThinkCentre', 'ThinkSystem'],
        isGeneralAgent: true,
        isAgent: false,
        createdAt: '2023-01-15'
    },
    {
        id: 2,
        _id: '2',
        name: 'HPE（美国）',
        code: 'HPE_US',
        category: ['服务器', '存储设备'],
        region: '其他',
        contact: 'John Smith',
        phone: '+1-408-555-0123',
        email: 'john.smith@hpe.com',
        address: 'San Jose, CA 95110, USA',
        status: 'active',
        type: 'HARDWARE',
        website: 'https://www.hpe.com',
        brands: ['ProLiant', 'Apollo', 'Synergy'],
        isGeneralAgent: false,
        isAgent: true,
        createdAt: '2023-02-20'
    },
    {
        id: 3,
        _id: '3',
        name: 'Microsoft（美国）',
        code: 'MSFT_US',
        category: ['软件系统', '云服务'],
        region: '其他',
        contact: 'Sarah Johnson',
        phone: '+1-425-555-0199',
        email: 'sarah.johnson@microsoft.com',
        address: 'Redmond, WA 98052, USA',
        status: 'active',
        type: 'SOFTWARE',
        website: 'https://www.microsoft.com',
        brands: ['Windows Server', 'Azure', 'Office 365'],
        isGeneralAgent: true,
        isAgent: false,
        createdAt: '2023-03-10'
    },
    {
        id: 4,
        _id: '4',
        name: '华为（中国）',
        code: 'HUAWEI_CN',
        category: ['网络设备', '存储设备', '服务器'],
        region: '其他',
        contact: '李总监',
        phone: '+86-755-2878-8888',
        email: 'li@huawei.com',
        address: '深圳市龙岗区坂田华为基地',
        status: 'active',
        type: 'HARDWARE',
        website: 'https://www.huawei.com',
        brands: ['FusionServer', 'CloudEngine', 'OceanStor'],
        isGeneralAgent: true,
        isAgent: false,
        createdAt: '2023-04-05'
    }
]; 