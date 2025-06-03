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

// 模拟数据
export const mockQuotations: QuotationRecord[] = [
    {
        id: '1',
        productName: '服务器Pro Max',
        productSpec: 'CPU: 2.5GHz, 内存: 64GB, 硬盘: 2TB',
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
  - 缓存：2GB

- 网络：
  - 4x 10GbE SFP+
  - 2x 1GbE RJ45
  - 支持带外管理
  - 支持网络绑定
  - 支持vLAN

- 电源：
  - 2x 1100W 铂金级冗余电源
  - 80Plus白金认证
  - 热插拔支持
  - 输入电压：100-240V
  - 效率：>94%

- 散热：
  - 8个冗余风扇
  - 智能温控
  - 前后风道设计
  
- 扩展槽：
  - 3个PCIe 4.0 x16
  - 2个PCIe 4.0 x8
  - 支持GPU加速卡

- 管理功能：
  - 集成BMC
  - IPMI 2.0
  - 远程管理许可
  - KVM over IP
  - 虚拟媒体支持
  - 硬件监控
  - 自动告警

- 机箱：
  - 2U机架式
  - 尺寸：87.5 x 447 x 735.6 mm
  - 重量：23kg（满配）
  - 工作温度：10-35℃
  - 相对湿度：8-90%

- 认证：
  - CE认证
  - FCC认证
  - CCC认证
  - RoHS认证

- 系统兼容：
  - Windows Server 2019/2022
  - RHEL 7/8/9
  - SLES 12/15
  - VMware ESXi 6.7/7.0
  - XenServer 7.x

- 服务支持：
  - 5年原厂质保
  - 7x24技术支持
  - 4小时响应
  - 备件次日达
  - 驻场工程师（可选）`,
        vendor: '华为技术有限公司',
        originalPrice: 35999,
        finalPrice: 32399.1,
        quantity: 10,
        discount: 0.9,
        quotationDate: '2024-03-15',
        isValid: true,
        remark: '大批量优惠价格',
        category: '服务器',
        region: '华北',
        attachments: [
            {
                id: '1-1',
                name: '原厂报价单.pdf',
                url: '/files/quotation.pdf'
            }
        ]
    },
    {
        id: '2',
        productName: 'Catalyst 9300 交换机',
        productSpec: '48口全千兆企业级交换机，4个10G上联口',
        configDetail: `详细配置：
- 端口配置：
  - 48x 10/100/1000BASE-T RJ45
  - 4x 10G SFP+ 上联
  - 1x 管理口
  - 1x USB Type-A
  - 1x USB Type-C
  - 1x RJ45串口

- 性能：
  - 交换容量：256Gbps
  - 包转发率：190Mpps
  - MAC地址表：32K
  - VLAN：4094
  - 跳数：64
  - MTU：9198字节
  - 缓存：32MB
  
- 堆叠：
  - StackWise-480
  - 最大带宽：480Gbps
  - 最大8台设备
  - 统一管理
  - 零中断升级
  
- 电源：
  - 双电源冗余
  - 1100W PoE预算
  - 支持n+1和n+n冗余
  - 热插拔
  
- 环境：
  - 工作温度：-5至45℃
  - 存储温度：-40至70℃
  - 工作湿度：10%至90%
  - 噪音：最大44dBA
  
- 物理规格：
  - 1RU高度
  - 尺寸：4.4 x 44.4 x 57.2 cm
  - 重量：7.0 kg
  
- 安全特性：
  - MACsec-256
  - 思科信任锚
  - 运行时防御
  - 映像签名验证
  
- 软件许可：
  - Network Advantage
  - DNA Advantage
  - 3年订阅
  
- 质保：
  - 终身硬件保修
  - 90天软件保修
  - NBD硬件更换`,
        vendor: 'Cisco Systems',
        originalPrice: 45999,
        finalPrice: 41399.1,
        quantity: 5,
        discount: 0.9,
        quotationDate: '2024-03-14',
        isValid: true,
        remark: '含3年原厂服务',
        category: '网络设备',
        region: '华东',
        attachments: [
            {
                id: '2-1',
                name: '思科原厂报价单.pdf',
                url: '/files/cisco-quote.pdf'
            }
        ]
    }
]; 