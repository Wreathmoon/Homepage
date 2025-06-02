import { request } from '../utils/request';

// 产品接口定义
export interface Product {
    id: string;
    name: string;
    model: string;
    category: string;
    description: string;
    price: number;
    currency: string;
    availability: boolean;
}

// 供应商类型
export interface Vendor {
    id: string;
    name: string;                 // 供应商名称
    type: string;                 // 供应商类型
    isGeneralAgent: boolean;      // 是否总代理商
    isAgent: boolean;             // 是否代理商
    country: string;              // 国家
    contact: string;              // 联系人
    website?: string;             // 网站
    brands: string[];            // 供应商提供的品牌
    account: string;             // 账号
    password: string;            // 密码
    products: string[];         // 供应产品类别
}

export interface VendorQueryParams {
    country?: string;
    type?: string;               // 供应商类型
    isGeneralAgent?: boolean;    // 是否总代理商
    isAgent?: boolean;           // 是否代理商
    keyword?: string;            // 关键字搜索（用于搜索名称、品牌等）
    productCategory?: string;    // 产品类别
    productKeyword?: string;     // 产品关键字
    page: number;
    pageSize: number;
}

// 产品类别
export const PRODUCT_CATEGORIES = [
    '交换机',
    '路由器',
    '服务器',
    '存储设备',
    '安全设备',
    '网络配件',
    '云服务'
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export interface QuotationHistory {
    id: string;
    productName: string;
    price: number;
    currency: string;
    quoteDate: string;
}

interface VendorResponse {
    data: Vendor[];
    total: number;
}

// 模拟数据
const mockVendors: Vendor[] = [
    {
        id: '1',
        name: '华为技术有限公司',
        type: 'HARDWARE',
        isGeneralAgent: false,
        isAgent: false,
        country: '中国',
        contact: '张三',
        website: 'https://www.huawei.com',
        brands: ['华为', 'HUAWEI'],
        account: 'huawei_admin',
        password: 'huawei123',
        products: ['交换机', '路由器', '服务器', '存储设备', '安全设备']
    },
    {
        id: '2',
        name: 'Cisco Systems GmbH',
        type: 'HARDWARE',
        isGeneralAgent: true,
        isAgent: false,
        country: '德国',
        contact: 'John Smith',
        website: 'https://www.cisco.com',
        brands: ['Cisco', 'Meraki'],
        account: 'cisco_admin',
        password: 'cisco123',
        products: ['交换机', '路由器', '安全设备', '网络配件']
    },
    {
        id: '3',
        name: '深圳市腾讯计算机系统有限公司',
        type: 'HARDWARE',
        isGeneralAgent: false,
        isAgent: true,
        country: '中国',
        contact: '李四',
        website: 'https://www.tencent.com',
        brands: ['腾讯云'],
        account: 'tencent_admin',
        password: 'tencent123',
        products: ['服务器', '云服务', '存储设备']
    }
];

const mockQuotationHistory: { [key: string]: QuotationHistory[] } = {
    // 华为的历史报价
    '1': [
        {
            id: '1',
            productName: '华为 CloudEngine S5735-L48T4X-A 交换机',
            price: 35999,
            currency: 'CNY',
            quoteDate: '2024-03-10'
        },
        {
            id: '2',
            productName: '华为 AR6280 路由器',
            price: 42999,
            currency: 'CNY',
            quoteDate: '2024-03-05'
        }
    ],
    // Cisco的历史报价
    '2': [
        {
            id: '3',
            productName: 'Cisco Catalyst 9300 交换机',
            price: 5999.99,
            currency: 'USD',
            quoteDate: '2024-03-15'
        },
        {
            id: '4',
            productName: 'Cisco ISR 4451-X 路由器',
            price: 8599.99,
            currency: 'USD',
            quoteDate: '2024-03-01'
        }
    ],
    // 腾讯的历史报价
    '3': [
        {
            id: '5',
            productName: '腾讯云 T4 服务器',
            price: 25999,
            currency: 'CNY',
            quoteDate: '2024-03-12'
        },
        {
            id: '6',
            productName: '腾讯云 GPU 服务器',
            price: 45999,
            currency: 'CNY',
            quoteDate: '2024-02-28'
        }
    ]
};

// 模拟产品数据
const mockProducts: { [key: string]: Product[] } = {
    // 华为的产品
    '1': [
        {
            id: 'hw1',
            name: 'CloudEngine S5735-L48T4X-A',
            model: 'S5735-L48T4X-A',
            category: '交换机',
            description: '48口千兆企业级交换机',
            price: 35999,
            currency: 'CNY',
            availability: true
        },
        {
            id: 'hw2',
            name: 'AR6280',
            model: 'AR6280',
            category: '路由器',
            description: '企业级路由器',
            price: 42999,
            currency: 'CNY',
            availability: true
        },
        {
            id: 'hw3',
            name: 'OceanStor 5300 V5',
            model: '5300 V5',
            category: '存储',
            description: '企业级存储系统',
            price: 150000,
            currency: 'CNY',
            availability: false
        }
    ],
    // Cisco的产品
    '2': [
        {
            id: 'cs1',
            name: 'Catalyst 9300',
            model: 'C9300-48T',
            category: '交换机',
            description: '48口千兆企业级交换机',
            price: 5999.99,
            currency: 'USD',
            availability: true
        },
        {
            id: 'cs2',
            name: 'ISR 4451-X',
            model: 'ISR4451-X/K9',
            category: '路由器',
            description: '企业级路由器',
            price: 8599.99,
            currency: 'USD',
            availability: true
        }
    ],
    // 腾讯的产品
    '3': [
        {
            id: 'tx1',
            name: '腾讯云服务器',
            model: 'T4',
            category: '服务器',
            description: '高性能云服务器',
            price: 25999,
            currency: 'CNY',
            availability: true
        },
        {
            id: 'tx2',
            name: '腾讯云GPU服务器',
            model: 'GPU-V100',
            category: '服务器',
            description: 'GPU加速云服务器',
            price: 45999,
            currency: 'CNY',
            availability: true
        }
    ]
};

// 获取供应商列表
export async function getVendorList(params: VendorQueryParams): Promise<{ data: Vendor[]; total: number }> {
    return new Promise((resolve) => {
        setTimeout(() => {
            let filteredData = [...mockVendors];
            
            // 代理类型筛选（优先级最高）
            if (params.isGeneralAgent !== undefined || params.isAgent !== undefined) {
                filteredData = filteredData.filter(v => {
                    if (params.isGeneralAgent) {
                        return v.isGeneralAgent === true;
                    }
                    if (params.isAgent) {
                        return v.isAgent === true && v.isGeneralAgent === false;
                    }
                    return !v.isGeneralAgent && !v.isAgent;
                });
            }
            
            // 供应商类型筛选
            if (params.type) {
                filteredData = filteredData.filter(v => v.type === params.type);
            }
            
            // 国家/地区筛选
            if (params.country) {
                filteredData = filteredData.filter(v => v.country === params.country);
            }

            // 产品类别筛选
            if (params.productCategory) {
                filteredData = filteredData.filter(v => 
                    v.products.includes(params.productCategory!)
                );
            }

            // 产品关键字搜索
            if (params.productKeyword) {
                const keyword = params.productKeyword.toLowerCase();
                filteredData = filteredData.filter(v => 
                    v.products.some(p => p.toLowerCase().includes(keyword))
                );
            }

            // 供应商关键字搜索（优先级最低）
            if (params.keyword) {
                const keyword = params.keyword.toLowerCase();
                filteredData = filteredData.filter(v => 
                    v.name.toLowerCase().includes(keyword) ||
                    v.brands.some(brand => brand.toLowerCase().includes(keyword))
                );
            }

            const start = (params.page - 1) * params.pageSize;
            const end = start + params.pageSize;
            const data = filteredData.slice(start, end);

            resolve({
                data,
                total: filteredData.length
            });
        }, 500);
    });
}

// 获取供应商产品类别
export async function getVendorProducts(vendorId: string): Promise<{ data: string[] }> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const vendor = mockVendors.find(v => v.id === vendorId);
            resolve({
                data: vendor?.products || []
            });
        }, 500);
    });
}

// 获取所有可用产品（用于筛选）
export async function getAllProducts(): Promise<{ data: Product[] }> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const allProducts = Object.values(mockProducts)
                .flat()
                .filter(p => p.availability);
            resolve({
                data: allProducts
            });
        }, 300);
    });
}

// 获取供应商历史报价
export async function getVendorQuotationHistory(vendorId: string): Promise<{ data: QuotationHistory[] }> {
    // 模拟API调用
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                data: mockQuotationHistory[vendorId] || []
            });
        }, 500);
    });
}

// 获取筛选项数据
export async function getFilterOptions() {
    // 模拟API调用
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                types: ['HARDWARE', 'SOFTWARE', 'SERVICE'],
                countries: ['中国', '美国', '德国', '日本'],
                brands: ['华为', 'Cisco', '腾讯云', 'AWS', 'Azure']
            });
        }, 300);
    });
} 