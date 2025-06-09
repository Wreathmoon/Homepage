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
        configDetail: `详细配置清单：

═══════════════════════════════════════════════

【处理器配置】
- CPU型号：Intel Xeon Gold 5318Y
  - 核心数量：24核心
  - 线程数量：48线程
  - 基础频率：2.1GHz
  - 最大睿频：3.4GHz
  - 三级缓存：36MB
  - 制程工艺：10nm
  - TDP功耗：165W
  - 支持指令集：AVX-512, SSE4.1/4.2
  - 内存控制器：8通道DDR4-3200
  - PCIe通道：48条PCIe 4.0

【内存配置】
- 总容量：64GB
- 内存类型：DDR4 ECC RDIMM
- 内存频率：3200MHz
- 内存时序：CL22-22-22-52
- 内存电压：1.2V
- 可扩展至：2TB（最大支持）
- 内存插槽总数：32个DIMM插槽
- 已使用插槽：8个
- 单条容量：8GB
- 内存品牌：Samsung/Micron
- 错误纠正：支持ECC错误纠正
- 内存带宽：204.8 GB/s
- 内存通道：8通道配置
- 支持内存镜像：是
- 支持内存热备：是

【存储系统】
系统盘：
- 容量：2x 240GB SATA SSD
- 配置：RAID 1镜像
- 品牌：Intel DC S4510
- 接口：SATA 3.0 6Gb/s
- 顺序读取：560MB/s
- 顺序写入：510MB/s
- 随机读取IOPS：75,000
- 随机写入IOPS：36,000
- 耐久度：1.3 DWPD

数据盘：
- 容量：4x 960GB NVMe SSD
- 配置：RAID 5（可用容量2.88TB）
- 品牌：Samsung PM983
- 接口：PCIe 3.0 x4 NVMe
- 顺序读取：3,500MB/s
- 顺序写入：3,000MB/s
- 随机读取IOPS：500,000
- 随机写入IOPS：50,000
- 耐久度：1 DWPD（5年质保）

存储扩展能力：
- 支持硬盘数量：最多24个2.5寸硬盘位
- 支持热插拔：是（所有硬盘位）
- RAID控制器：LSI MegaRAID 9460-16i
- RAID控制器缓存：4GB DDR4带BBU
- RAID支持级别：0, 1, 5, 6, 10, 50, 60
- 备用硬盘支持：全局和专用热备盘

【主板与芯片组】
- 主板型号：Intel C621A芯片组
- 主板规格：双路服务器主板
- BIOS：UEFI BIOS 2.7
- 可信平台模块：TPM 2.0
- 系统管理：IPMI 2.0
- 远程管理：基于Web的BMC
- 串行端口：2个RS232串口
- USB端口：6个USB 3.0端口

【网络配置】
板载网络：
- 网卡数量：4个千兆以太网端口
- 网卡型号：Intel I350-AM4
- 网卡功能：支持网络唤醒、PXE启动
- 网络卸载：TCP/UDP/IP校验和卸载
- VLAN支持：802.1Q VLAN标记
- 链路聚合：支持LACP

可选网络扩展：
- 10GbE光纤网卡：Intel X710-DA2
- 25GbE网卡：Mellanox ConnectX-4 Lx
- InfiniBand：Mellanox ConnectX-6
- 网络处理器：支持SR-IOV虚拟化

【电源系统】
- 电源类型：1+1冗余热插拔电源
- 单电源功率：1100W 80Plus 铂金
- 输入电压：100-240V AC自适应
- 输入频率：50/60Hz
- 功率因子：>0.95
- 电源效率：>94%（80Plus铂金认证）
- 电源接口：C19电源插头
- 电源监控：实时功耗监控

【散热系统】
CPU散热：
- 散热器类型：2U被动式散热器
- 散热材料：铜质热管+铝质散热鳍片
- 热设计功耗：支持165W TDP
- 散热器数量：2个（双CPU配置）

系统风扇：
- 风扇数量：6个系统风扇
- 风扇类型：热插拔冗余风扇
- 风扇转速：可变速控制（PWM）
- 噪音水平：<65dB（满载）
- 风扇寿命：5年或50,000小时

【机箱规格】
- 机箱高度：2U机架式
- 机箱深度：650mm
- 机箱宽度：标准19英寸机架
- 重量：约25kg（满配置）
- 材质：优质钢材+铝合金面板
- 防护等级：IP20
- 机架导轨：滑轨式快装导轨

【扩展插槽】
- PCIe插槽总数：8个
- PCIe 4.0 x16：4个全高全长
- PCIe 4.0 x8：2个半高半长
- PCIe 3.0 x4：2个M.2插槽
- 显卡支持：最多2个双宽GPU
- 扩展卡支持：RAID卡、网卡、加速卡

【操作系统支持】
Windows Server：
- Windows Server 2022
- Windows Server 2019
- Windows Server 2016

Linux发行版：
- Red Hat Enterprise Linux 8.x/9.x
- SUSE Linux Enterprise Server 15
- Ubuntu Server 20.04/22.04 LTS
- CentOS 7.x/8.x
- Rocky Linux 8.x/9.x

虚拟化平台：
- VMware vSphere 7.0/8.0
- Microsoft Hyper-V 2019/2022
- Citrix XenServer 8.x
- Red Hat Virtualization 4.x
- Proxmox VE 7.x/8.x

【管理功能】
带外管理：
- BMC芯片：Aspeed AST2600
- 管理接口：1Gb专用管理网口
- 远程控制：IPMI 2.0/Redfish
- KVM功能：HTML5 Web KVM
- 虚拟介质：ISO挂载支持
- 系统监控：温度、电压、风扇转速
- 告警通知：SNMP、邮件告警

【安全功能】
硬件安全：
- TPM 2.0安全芯片
- Secure Boot安全启动
- 硬件信任根
- 启动保护：UEFI固件验证
- 内存保护：内存加密支持

软件安全：
- BIOS密码保护
- 硬盘加密支持
- 网络安全：802.1X认证
- 审计日志：系统事件记录

【认证与质保】
产品认证：
- FCC Class A认证
- CE认证
- CCC中国强制认证
- Energy Star节能认证
- EPEAT环保认证

质保服务：
- 硬件质保：3年现场服务
- 7x24小时技术支持
- 4小时硬件响应
- 现场工程师服务
- 备件库存保障

【环境参数】
工作环境：
- 工作温度：10°C - 35°C
- 存储温度：-40°C - 70°C
- 工作湿度：8% - 90%（无冷凝）
- 存储湿度：5% - 95%（无冷凝）
- 工作海拔：0 - 3000米
- 存储海拔：0 - 12000米

═══════════════════════════════════════════════

配置清单完毕，如需了解更多技术细节或定制化配置，请联系技术支持团队。`
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
    // const response = await request(API_ENDPOINTS.QUOTATION_DETAIL.replace(':id', id), {
    //     method: 'GET'
    // });
    // return response;
    
    // 暂时使用mock数据
    const mockRecord = mockQuotations.find(item => item.id === id);
    if (mockRecord) {
        return mockRecord;
    }
    throw new Error('记录不存在');
}

// API 函数：添加历史报价
export async function createQuotation(data: Omit<QuotationRecord, 'id'>): Promise<{ id: string }> {
    // TODO: 替换为实际API调用
    // const response = await request(API_ENDPOINTS.QUOTATION_CREATE, {
    //     method: 'POST',
    //     data
    // });
    // return response;
    
    // 暂时使用mock数据
    return { id: Date.now().toString() };
}

// API 函数：更新历史报价
export async function updateQuotation(id: string, data: Partial<QuotationRecord>): Promise<{ success: boolean }> {
    // TODO: 替换为实际API调用
    // const response = await request(API_ENDPOINTS.QUOTATION_UPDATE.replace(':id', id), {
    //     method: 'PUT',
    //     data
    // });
    // return response;
    
    // 暂时使用mock数据
    return { success: true };
}

// API 函数：删除历史报价
export async function deleteQuotation(id: string): Promise<{ success: boolean }> {
    // TODO: 替换为实际API调用
    // const response = await request(API_ENDPOINTS.QUOTATION_DELETE.replace(':id', id), {
    //     method: 'DELETE'
    // });
    // return response;
    
    // 暂时使用mock数据
    return { success: true };
}

// API 函数：下载附件
export async function downloadAttachment(attachmentId: string): Promise<Blob> {
    // TODO: 替换为实际API调用
    // const response = await request(API_ENDPOINTS.ATTACHMENT_DOWNLOAD.replace(':id', attachmentId), {
    //     method: 'GET',
    //     responseType: 'blob'
    // });
    // return response;
    
    // 暂时使用mock数据
    return new Blob(['mock attachment content']);
} 