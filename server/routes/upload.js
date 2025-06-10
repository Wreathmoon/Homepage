const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const router = express.Router();
const Quotation = require('../models/quotation');

// 配置文件存储
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        // 生成唯一文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `quotation-${uniqueSuffix}${ext}`);
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/pdf', // .pdf
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型，请上传 Excel、CSV、PDF 或 Word 文档'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// 报价文件上传和解析
router.post('/quotation', upload.single('quotationFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传文件'
            });
        }

        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const fileExtension = path.extname(originalName).toLowerCase();

        let quotations = [];

        // 根据文件类型进行解析
        if (fileExtension === '.xlsx' || fileExtension === '.xls') {
            quotations = await parseExcelFile(filePath);
        } else if (fileExtension === '.csv') {
            quotations = await parseCsvFile(filePath);
        } else {
            // 对于 PDF、Word 等文件，先保存记录，稍后手动录入
            quotations = [{
                productName: path.basename(originalName, fileExtension),
                supplier: '待录入',
                quote_unit_price: 0,
                quantity: 1,
                quote_total_price: 0,
                quote_validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
                currency: 'EUR',
                notes: '需要手动录入报价信息',
                originalFile: {
                    filename: req.file.filename,
                    originalName: originalName,
                    path: filePath,
                    uploadedAt: new Date()
                }
            }];
        }

        // 保存解析的报价数据到数据库
        const savedQuotations = [];
        for (const quotationData of quotations) {
            // 添加文件信息
            quotationData.originalFile = {
                filename: req.file.filename,
                originalName: originalName,
                path: filePath,
                uploadedAt: new Date()
            };

            const quotation = new Quotation(quotationData);
            const saved = await quotation.save();
            savedQuotations.push(saved);
        }

        res.json({
            success: true,
            message: `成功上传并解析文件，共处理 ${savedQuotations.length} 条报价记录`,
            data: savedQuotations,
            file: {
                originalName: originalName,
                filename: req.file.filename,
                size: req.file.size
            }
        });

    } catch (error) {
        console.error('文件上传失败:', error);
        
        // 如果保存失败，删除上传的文件
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.warn('删除上传文件失败:', unlinkError.message);
            }
        }

        res.status(500).json({
            success: false,
            message: '文件上传失败',
            error: error.message
        });
    }
});

// 供应商数据上传
router.post('/vendor', upload.single('vendorFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传文件'
            });
        }

        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const fileExtension = path.extname(originalName).toLowerCase();

        let vendors = [];

        // 解析Excel文件
        if (fileExtension === '.xlsx' || fileExtension === '.xls') {
            vendors = await parseVendorExcelFile(filePath);
        } else {
            throw new Error('供应商数据仅支持 Excel 格式文件');
        }

        // 导入供应商数据
        const Vendor = require('../models/vendor');
        const savedVendors = await Vendor.insertMany(vendors, { ordered: false });

        // 删除临时文件
        await fs.unlink(filePath);

        res.json({
            success: true,
            message: `成功导入 ${savedVendors.length} 个供应商`,
            data: savedVendors
        });

    } catch (error) {
        console.error('供应商数据上传失败:', error);
        
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.warn('删除上传文件失败:', unlinkError.message);
            }
        }

        res.status(500).json({
            success: false,
            message: '供应商数据上传失败',
            error: error.message
        });
    }
});

// 解析Excel报价文件
async function parseExcelFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const quotations = [];

    for (const row of jsonData) {
        // 获取基本字段，确保不为空
        const productName = (row['产品名称'] || row['Product Name'] || row['产品'] || '').toString().trim();
        const supplier = (row['供应商'] || row['Supplier'] || row['供应商名称'] || '').toString().trim();
        
        // 跳过没有关键信息的行
        if (!productName || !supplier) {
            console.warn('跳过无效行，缺少产品名称或供应商:', row);
            continue;
        }

        // 处理价格信息
        const listPrice = parseFloat(row['定价'] || row['List Price'] || 0) || null;
        const unitPrice = parseFloat(row['报价单价'] || row['Unit Price'] || row['单价'] || 0) || 0;
        const quantity = parseInt(row['数量'] || row['Quantity'] || 1) || 1;
        
        // 处理枚举字段，提供默认值
        const category = (row['类别'] || row['Category'] || '').toString().trim();
        const region = (row['区域'] || row['Region'] || '').toString().trim();
        
        // 验证枚举值，如果无效则使用默认值
        const validCategories = ['服务器', '存储设备', '网络设备', '安全设备', '软件系统', '云服务', '其他'];
        const validRegions = ['华北', '华东', '华南', '华中', '西南', '西北', '东北', '海外'];
        
        const finalCategory = validCategories.includes(category) ? category : '其他';
        const finalRegion = validRegions.includes(region) ? region : '华北';

        // 处理日期
        let validityDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 默认30天后
        if (row['有效期'] || row['Valid Until']) {
            const inputDate = new Date(row['有效期'] || row['Valid Until']);
            if (!isNaN(inputDate.getTime())) {
                validityDate = inputDate;
            }
        }

        const quotation = {
            // 必填字段
            productName: productName,
            name: productName, // 向后兼容
            supplier: supplier,
            quote_unit_price: unitPrice,
            quantity: quantity,
            quote_total_price: unitPrice * quantity,
            quote_validity: validityDate,
            currency: 'EUR', // 默认货币
            
            // 可选字段
            list_price: listPrice,
            notes: (row['备注'] || row['Notes'] || row['说明'] || '').toString().trim() || null,
            configDetail: (row['配置详情'] || row['Configuration'] || row['配置'] || '').toString().trim() || null,
            productSpec: (row['配置详情'] || row['Configuration'] || row['配置'] || '').toString().trim() || null,
            
            // 枚举字段（有默认值）
            category: finalCategory,
            region: finalRegion,
            status: 'active'
        };

        // 计算折扣率
        if (listPrice && unitPrice && listPrice > 0) {
            quotation.discount_rate = ((listPrice - unitPrice) / listPrice * 100);
        }

        quotations.push(quotation);
    }

    return quotations;
}

// 解析CSV文件
async function parseCsvFile(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const quotations = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            const quotation = {
                productName: row['产品名称'] || row['Product Name'] || '',
                name: row['产品名称'] || row['Product Name'] || '',
                supplier: row['供应商'] || row['Supplier'] || '',
                list_price: parseFloat(row['定价'] || row['List Price'] || 0),
                quote_unit_price: parseFloat(row['报价单价'] || row['Unit Price'] || 0),
                quantity: parseInt(row['数量'] || row['Quantity'] || 1),
                quote_total_price: parseFloat(row['总价'] || row['Total Price'] || 0),
                currency: row['币种'] || row['Currency'] || 'EUR',
                quote_validity: new Date(row['有效期'] || Date.now() + 30 * 24 * 60 * 60 * 1000),
                notes: row['备注'] || row['Notes'] || ''
            };
            
            if (!quotation.quote_total_price && quotation.quote_unit_price && quotation.quantity) {
                quotation.quote_total_price = quotation.quote_unit_price * quotation.quantity;
            }
            
            quotations.push(quotation);
        }
    }
    
    return quotations;
}

// 解析供应商Excel文件
async function parseVendorExcelFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const vendors = [];

    for (const row of jsonData) {
        const vendor = {
            name: row['供应商名称'] || row['Name'] || '',
            code: row['供应商代码'] || row['Code'] || `VENDOR_${Date.now()}_${vendors.length}`,
            category: (row['产品类别'] || row['Category'] || '').split(',').map(c => c.trim()).filter(c => c),
            region: row['区域'] || row['Region'] || '',
            contact: row['联系人'] || row['Contact'] || '',
            phone: row['电话'] || row['Phone'] || '',
            email: row['邮箱'] || row['Email'] || '',
            address: row['地址'] || row['Address'] || '',
            type: row['类型'] || row['Type'] || 'HARDWARE',
            country: row['国家'] || row['Country'] || '',
            website: row['网站'] || row['Website'] || '',
            brands: (row['代理品牌'] || row['Brands'] || '').split(',').map(b => b.trim()).filter(b => b),
            isGeneralAgent: (row['总代理'] || row['General Agent'] || 'false').toLowerCase() === 'true',
            isAgent: (row['经销商'] || row['Agent'] || 'false').toLowerCase() === 'true',
            level: row['级别'] || row['Level'] || 'B',
            status: row['状态'] || row['Status'] || 'active'
        };

        vendors.push(vendor);
    }

    return vendors;
}

module.exports = router; 