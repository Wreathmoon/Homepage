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
    id: number;
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

// 模拟数据
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

// API 函数
export async function getVendorList(params: VendorQueryParams) {
    await new Promise(resolve => setTimeout(resolve, 500));

    let filteredVendors = [...mockVendors];

    if (params.type) {
        filteredVendors = filteredVendors.filter(v => v.type === params.type);
    }

    if (params.country) {
        filteredVendors = filteredVendors.filter(v => v.country === params.country);
    }

    if (typeof params.isGeneralAgent === 'boolean') {
        filteredVendors = filteredVendors.filter(v => v.isGeneralAgent === params.isGeneralAgent);
    }

    if (typeof params.isAgent === 'boolean') {
        filteredVendors = filteredVendors.filter(v => v.isAgent === params.isAgent);
    }

    if (params.productCategory) {
        filteredVendors = filteredVendors.filter(v => 
            v.category.includes(params.productCategory as ProductCategory)
        );
    }

    if (params.keyword) {
        const keyword = params.keyword.toLowerCase();
        filteredVendors = filteredVendors.filter(v => 
            v.name.toLowerCase().includes(keyword) ||
            v.brands.some(brand => brand.toLowerCase().includes(keyword))
        );
    }

    const startIndex = ((params.page || 1) - 1) * (params.pageSize || 10);
    const endIndex = startIndex + (params.pageSize || 10);
    const paginatedVendors = filteredVendors.slice(startIndex, endIndex);

    return {
        data: paginatedVendors,
        total: filteredVendors.length
    };
}

export async function getVendorProducts(vendorId: number) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const vendor = mockVendors.find(v => v.id === vendorId);
    return {
        data: vendor?.category || []
    };
} 