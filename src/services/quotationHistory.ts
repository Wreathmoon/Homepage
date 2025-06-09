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

// 定义历史报价记录接口
export interface QuotationRecord {
    id: string;
    productName: string;    // 产品名称
    productSpec: string;    // 产品详解/配置
    configDetail?: string;  // 详细配置文档
    vendor: string;        // 供应商
    originalPrice: number; // 单价（折扣前）
    finalPrice: number;   // 到手价（折扣后）
    quantity: number;     // 数量
    discount: number;     // 折扣率
    quotationDate: string; // 报价日期
    isValid: boolean;     // 报价是否有效
    remark: string;       // 备注
    category: string;     // 产品类别
    region: string;       // 地区
    attachments?: Array<{  // 附件列表
        id: string;
        name: string;
        url: string;
    }>;
}

// 定义查询参数接口
export interface QuotationQueryParams {
    vendor?: string;          // 供应商
    productType?: string;     // 产品类型
    region?: string;          // 地区
    category?: string;        // 产品类别
    productKeyword?: string;  // 产品关键字
    page: number;
    pageSize: number;
}

// Mock产品类别
export const PRODUCT_CATEGORIES = [
    '服务器',
    '存储设备',
    '网络设备',
    '安全设备',
    '软件系统',
    '云服务',
    '其他'
] as const;

// Mock地区
export const REGIONS = [
    '华北',
    '华东',
    '华南',
    '华中',
    '西南',
    '西北',
    '东北',
    '海外'
] as const;

// Mock数据
export const mockQuotations: QuotationRecord[] = [
    {
        id: '1',
        productName: '服务器Pro Max',
        category: '服务器',
        region: '华北',
        productSpec: 'CPU: 2.5GHz, 内存: 64GB, 硬盘: 2TB',
        vendor: '联想',
        originalPrice: 45000,
        finalPrice: 42000,
        quantity: 10,
        discount: 0.93,
        quotationDate: '2024-03-15',
        isValid: true,
        remark: '含三年原厂质保',
        configDetail: `详细配置：
- CPU: Intel Xeon Gold 5318Y
  - 核心数：24
  - 基础频率：2.1GHz
  - 睿频：3.4GHz
  - 三级缓存：36MB

- 内存：
  - 总容量：64GB
  - 类型：DDR4 ECC
  - 频率：3200MHz
  - 可扩展至：2TB
  - 内存插槽：32个
  - 已使用：8个
  - 单条容量：8GB

- 存储：
  - 系统盘：2x 240GB SATA SSD（RAID 1）
  - 数据盘：4x 960GB NVMe SSD（RAID 5）
  - 扩展性：支持最多24个2.5寸硬盘
  - 支持热插拔
  - RAID控制器：采用LSI 3108
  - 缓存：2GB`
    },
    {
        id: '2',
        productName: 'NetSwitch Pro',
        category: '网络设备',
        region: '华东',
        productSpec: '48口千兆交换机，4个10G上联口',
        vendor: '华为',
        originalPrice: 12000,
        finalPrice: 10800,
        quantity: 5,
        discount: 0.9,
        quotationDate: '2024-03-14',
        isValid: true,
        remark: '含基础安装服务'
    }
];

// API 函数：获取历史报价列表
export async function getQuotationList(params: QuotationQueryParams): Promise<{ data: QuotationRecord[]; total: number }> {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 过滤数据
    let filteredData = [...mockQuotations];
    
    // 应用筛选条件
    if (params.vendor) {
        const vendorKeyword = params.vendor.toLowerCase();
        filteredData = filteredData.filter(item => 
            item.vendor.toLowerCase().includes(vendorKeyword)
        );
    }
    
    if (params.category) {
        filteredData = filteredData.filter(item => 
            item.category === params.category
        );
    }
    
    if (params.region) {
        filteredData = filteredData.filter(item => 
            item.region === params.region
        );
    }
    
    if (params.productKeyword) {
        const keyword = params.productKeyword.toLowerCase();
        filteredData = filteredData.filter(item => 
            item.productName.toLowerCase().includes(keyword) ||
            item.productSpec.toLowerCase().includes(keyword)
        );
    }

    // 计算分页
    const total = filteredData.length;
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    const paginatedData = filteredData.slice(start, end);

    return {
        data: paginatedData,
        total
    };
}

// API 函数：获取历史报价详情
export async function getQuotationDetail(id: string): Promise<QuotationRecord> {
    // TODO: 替换为实际API调用
    const response = await request(API_ENDPOINTS.QUOTATION_DETAIL.replace(':id', id), {
        method: 'GET',
        mock: true
    });
    return response;
}

// API 函数：添加历史报价
export async function createQuotation(data: Omit<QuotationRecord, 'id'>): Promise<{ id: string }> {
    // TODO: 替换为实际API调用
    const response = await request(API_ENDPOINTS.QUOTATION_CREATE, {
        method: 'POST',
        data,
        mock: true
    });
    return response;
}

// API 函数：更新历史报价
export async function updateQuotation(id: string, data: Partial<QuotationRecord>): Promise<{ success: boolean }> {
    // TODO: 替换为实际API调用
    const response = await request(API_ENDPOINTS.QUOTATION_UPDATE.replace(':id', id), {
        method: 'PUT',
        data,
        mock: true
    });
    return response;
}

// API 函数：删除历史报价
export async function deleteQuotation(id: string): Promise<{ success: boolean }> {
    // TODO: 替换为实际API调用
    const response = await request(API_ENDPOINTS.QUOTATION_DELETE.replace(':id', id), {
        method: 'DELETE',
        mock: true
    });
    return response;
}

// API 函数：下载附件
export async function downloadAttachment(attachmentId: string): Promise<Blob> {
    // TODO: 替换为实际API调用
    const response = await request(API_ENDPOINTS.ATTACHMENT_DOWNLOAD.replace(':id', attachmentId), {
        method: 'GET',
        responseType: 'blob',
        mock: true
    });
    return response;
} 