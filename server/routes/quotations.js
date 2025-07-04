const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const Quotation = require('../models/quotation');
const multer = require('multer');

// 标准分类/地区列表（用于"其他"筛选逻辑）
const STANDARD_CATEGORIES = ['服务器', '存储设备', '网络设备', '安全设备', '软件系统', '云服务'];
const STANDARD_REGIONS = ['英国', '德国', '法国', '荷兰', '瑞典', '芬兰', '瑞士', '以色列'];

// 货币清理函数 - 去除货币符号，只保留货币代码
function cleanCurrency(currency) {
    if (!currency) return 'EUR'; // 默认值
    
    // 货币符号到代码的映射
    const currencyMap = {
        '$': 'USD',
        '€': 'EUR', 
        '£': 'GBP',
        '¥': 'JPY',
        'HK$': 'HKD',
        'A$': 'AUD',
        'C$': 'CAD',
        'S$': 'SGD',
        'CHF': 'CHF',
        'kr': 'SEK', // 默认为瑞典克朗
        '₹': 'INR',
        '₩': 'KRW',
        '฿': 'THB',
        'RM': 'MYR',
        'NT$': 'TWD',
        '₫': 'VND',
        'Rp': 'IDR',
        'R$': 'BRL',
        'R': 'ZAR',
        'NZ$': 'NZD',
        'zł': 'PLN',
        'Ft': 'HUF',
        'Kč': 'CZK',
        '₺': 'TRY',
        '﷼': 'SAR',
        'د.إ': 'AED',
        '₪': 'ILS'
    };
    
    // 移除空白字符
    let cleaned = currency.trim();
    
    // 如果已经是纯货币代码，直接返回
    if (/^[A-Z]{3}$/.test(cleaned)) {
        return cleaned.toUpperCase();
    }
    
    // 处理带符号的格式，如 $USD, €EUR 等
    for (const [symbol, code] of Object.entries(currencyMap)) {
        if (cleaned.includes(symbol)) {
            // 提取货币代码部分
            const codeMatch = cleaned.match(/[A-Z]{3}/);
            if (codeMatch) {
                return codeMatch[0].toUpperCase();
            }
            // 如果没有找到代码，直接返回映射的代码
            return code;
        }
    }
    
    // 尝试直接提取3位大写字母的货币代码
    const codeMatch = cleaned.match(/[A-Z]{3}/i);
    if (codeMatch) {
        return codeMatch[0].toUpperCase();
    }
    
    // 如果都匹配不到，返回默认值
    console.warn(`无法识别的货币格式: ${currency}, 使用默认值 EUR`);
    return 'EUR';
}

// 获取报价列表 - 专门的list路由 (匹配前端调用)
router.get('/list', async (req, res) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            supplier,
            productName,
            category,
            region,
            currency,
            status,
            startDate,
            endDate,
            keyword
        } = req.query;

        // 构建查询条件
        let query = {};

        if (supplier) query.supplier = { $regex: supplier, $options: 'i' };
        if (productName) query.productName = { $regex: productName, $options: 'i' };
        if (category) {
            if (category === '其他') {
                query.$or = [
                    { category: '其他' },
                    { category: { $nin: STANDARD_CATEGORIES } },
                    { category: { $exists: false } },
                    { category: null }
                ];
            } else {
                query.category = category;
            }
        }
        if (region) {
            if (region === '其他') {
                if (!query.$or) query.$or = [];
                query.$or.push({ region: '其他' }, { region: { $nin: STANDARD_REGIONS } }, { region: { $exists: false } }, { region: null });
            } else {
                query.region = region;
            }
        }
        if (currency) query.currency = currency;
        if (status) query.status = status;

        // 日期范围筛选
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // 关键字搜索
        if (keyword) {
            query.$or = [
                { productName: { $regex: keyword, $options: 'i' } },
                { supplier: { $regex: keyword, $options: 'i' } },
                { notes: { $regex: keyword, $options: 'i' } },
                { configDetail: { $regex: keyword, $options: 'i' } }
            ];
        }

        // 分页参数
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 执行查询
        const [quotations, total] = await Promise.all([
            Quotation.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Quotation.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: quotations,
            total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize))
        });

    } catch (error) {
        console.error('获取报价列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取报价列表失败',
            error: error.message
        });
    }
});

// 获取报价列表 (支持筛选和分页)
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            supplier,
            productName,
            category,
            region,
            currency,
            status,
            startDate,
            endDate,
            keyword
        } = req.query;

        // 构建查询条件
        let query = {};

        if (supplier) query.supplier = { $regex: supplier, $options: 'i' };
        if (productName) query.productName = { $regex: productName, $options: 'i' };
        if (category) {
            query.$or = [
                { category: '其他' },
                { category: { $nin: STANDARD_CATEGORIES } },
                { category: { $exists: false } },
                { category: null }
            ];
        }
        if (region) {
            if (region === '其他') {
                if (!query.$or) query.$or = [];
                query.$or.push({ region: '其他' }, { region: { $nin: STANDARD_REGIONS } }, { region: { $exists: false } }, { region: null });
            } else {
                query.region = region;
            }
        }
        if (currency) query.currency = currency;
        if (status) query.status = status;

        // 日期范围筛选
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // 关键字搜索
        if (keyword) {
            query.$or = [
                { productName: { $regex: keyword, $options: 'i' } },
                { supplier: { $regex: keyword, $options: 'i' } },
                { notes: { $regex: keyword, $options: 'i' } },
                { configDetail: { $regex: keyword, $options: 'i' } }
            ];
        }

        // 分页参数
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 执行查询
        const [quotations, total] = await Promise.all([
            Quotation.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Quotation.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: quotations,
            total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize))
        });

    } catch (error) {
        console.error('获取报价列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取报价列表失败',
            error: error.message
        });
    }
});

// 根据ID获取单个报价详情
router.get('/:id', async (req, res) => {
    try {
        const quotation = await Quotation.findById(req.params.id);
        
        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: '报价记录不存在'
            });
        }

        res.json({
            success: true,
            data: quotation
        });

    } catch (error) {
        console.error('获取报价详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取报价详情失败',
            error: error.message
        });
    }
});

// 添加新报价
router.post('/', async (req, res) => {
    try {
        // 清理货币字段
        const cleanedData = {
            ...req.body,
            currency: cleanCurrency(req.body.currency)
        };
        
        const quotation = new Quotation(cleanedData);
        await quotation.save();

        res.status(201).json({
            success: true,
            message: '报价添加成功',
            data: quotation,
            id: quotation._id
        });

    } catch (error) {
        console.error('添加报价失败:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        res.status(500).json({
            success: false,
            message: '添加报价失败',
            error: error.message
        });
    }
});

// 更新报价信息
router.put('/:id', async (req, res) => {
    try {
        // 清理货币字段
        const updateData = {
            ...req.body,
            ...(req.body.currency ? { currency: cleanCurrency(req.body.currency) } : {})
        };
        
        const quotation = await Quotation.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: '报价记录不存在'
            });
        }

        res.json({
            success: true,
            message: '报价更新成功',
            data: quotation,
            changes: 1
        });

    } catch (error) {
        console.error('更新报价失败:', error);
        res.status(500).json({
            success: false,
            message: '更新报价失败',
            error: error.message
        });
    }
});

// 删除报价
router.delete('/:id', async (req, res) => {
    try {
        const quotation = await Quotation.findByIdAndDelete(req.params.id);

        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: '报价记录不存在'
            });
        }

        // 删除相关的附件文件
        if (quotation.attachments && quotation.attachments.length > 0) {
            for (const attachment of quotation.attachments) {
                try {
                    if (attachment.path) {
                        await fs.unlink(attachment.path);
                    }
                } catch (fileError) {
                    console.warn('删除附件文件失败:', fileError.message);
                }
            }
        }

        // 删除原始文件
        if (quotation.originalFile && quotation.originalFile.path) {
            try {
                await fs.unlink(quotation.originalFile.path);
            } catch (fileError) {
                console.warn('删除原始文件失败:', fileError.message);
            }
        }

        res.json({
            success: true,
            message: '报价删除成功',
            changes: 1
        });

    } catch (error) {
        console.error('删除报价失败:', error);
        res.status(500).json({
            success: false,
            message: '删除报价失败',
            error: error.message
        });
    }
});

// 下载报价原始文件
router.get('/download/:id', async (req, res) => {
    try {
        console.log('🚀🚀🚀 下载路由调用 - 版本: 2024-01-01-FINAL-FIX 🚀🚀🚀');
        const quotation = await Quotation.findById(req.params.id);
        
        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: '报价记录不存在'
            });
        }

        if (!quotation.originalFile || !quotation.originalFile.path) {
            return res.status(404).json({
                success: false,
                message: '原始文件不存在'
            });
        }

        let filePath = quotation.originalFile.path;
        
        // 获取文件名，优先使用filename（它已经是正确的中文）
        let fileName = quotation.originalFile.filename || quotation.originalFile.originalName;
        
        console.log('📋 使用的文件名:', JSON.stringify(fileName));

        // 处理相对路径，确保指向正确的目录
        if (!path.isAbsolute(filePath)) {
            // 如果是相对路径，基于项目根目录而不是server目录
            filePath = path.join(__dirname, '../../', filePath);
        }

        console.log('📁 下载文件路径:', filePath);

        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            console.error('❌ 文件不存在:', filePath);
            return res.status(404).json({
                success: false,
                message: '文件不存在或已被删除'
            });
        }

        // 使用原始文件名（支持中文）
        console.log('📋 使用原始文件名:', fileName);
        console.log('🔧 开始下载文件...');

        // 直接通过 res.download 发送，Express 会自动处理 filename*=UTF-8 头，确保中文不乱码
        res.download(path.resolve(filePath), fileName);

    } catch (error) {
        console.error('下载文件失败:', error);
        res.status(500).json({
            success: false,
            message: '下载文件失败',
            error: error.message
        });
    }
});

// 下载报价附件
router.get('/attachment/:quotationId/:attachmentId', async (req, res) => {
    try {
        const { quotationId, attachmentId } = req.params;
        
        const quotation = await Quotation.findById(quotationId);
        if (!quotation) {
            return res.status(404).json({
                success: false,
                message: '报价记录不存在'
            });
        }

        const attachment = quotation.attachments.find(att => att.id === attachmentId);
        if (!attachment) {
            return res.status(404).json({
                success: false,
                message: '附件不存在'
            });
        }

        let filePath = attachment.path;
        // 优先使用name，因为originalName可能有编码问题
        const fileName = attachment.name || attachment.originalName;

        // 处理相对路径，确保指向正确的目录
        if (!path.isAbsolute(filePath)) {
            // 如果是相对路径，基于项目根目录而不是server目录
            filePath = path.join(__dirname, '../../', filePath);
        }

        console.log('📁 下载附件路径:', filePath);

        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            console.error('❌ 附件不存在:', filePath);
            return res.status(404).json({
                success: false,
                message: '文件不存在或已被删除'
            });
        }

        // 使用原始文件名，保留中文
        console.log('📋 附件原始文件名:', fileName);
        console.log('🔧 开始下载附件...');
        
        // 直接下载
        res.download(path.resolve(filePath), fileName);

    } catch (error) {
        console.error('下载附件失败:', error);
        res.status(500).json({
            success: false,
            message: '下载附件失败',
            error: error.message
        });
    }
});

// 获取报价统计信息
router.get('/stats/overview', async (req, res) => {
    try {
        const [
            totalCount,
            activeCount,
            expiredCount,
            recentCount,
            topSuppliers,
            currencyStats
        ] = await Promise.all([
            Quotation.countDocuments(),
            Quotation.countDocuments({ status: 'active' }),
            Quotation.countDocuments({ quote_validity: { $lt: new Date() } }),
            Quotation.countDocuments({ 
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }),
            Quotation.aggregate([
                { $group: { _id: '$supplier', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),
            Quotation.aggregate([
                { $group: { _id: '$currency', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        res.json({
            success: true,
            data: {
                totalCount,
                activeCount,
                expiredCount,
                recentCount,
                topSuppliers,
                currencyStats
            }
        });

    } catch (error) {
        console.error('获取统计信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计信息失败',
            error: error.message
        });
    }
});

// 清理测试数据的API接口
router.delete('/cleanup/test-data', async (req, res) => {
    try {
        // 删除包含测试关键字的数据
        const testKeywords = [
            'INT Xeon-G 5418Y CPU for HPE',
            'HPE DL380 Gen11 8SFF NIC CTO Svr',
            '服务器Pro Max',
            'TD SYNNEX',
            'test',
            'Test',
            'DEBUG',
            'debug',
            '测试',
            '调试'
        ];

        // 构建删除查询
        const deleteQuery = {
            $or: testKeywords.map(keyword => ({
                $or: [
                    { productName: { $regex: keyword, $options: 'i' } },
                    { supplier: { $regex: keyword, $options: 'i' } },
                    { notes: { $regex: keyword, $options: 'i' } },
                    { configDetail: { $regex: keyword, $options: 'i' } }
                ]
            }))
        };

        const deletedCount = await Quotation.deleteMany(deleteQuery);

        res.json({
            success: true,
            message: `成功删除 ${deletedCount.deletedCount} 条测试数据`,
            deletedCount: deletedCount.deletedCount
        });

    } catch (error) {
        console.error('清理测试数据失败:', error);
        res.status(500).json({
            success: false,
            message: '清理测试数据失败',
            error: error.message
        });
    }
});

// 确认保存报价数据 (批量保存)
router.post('/confirm-save', async (req, res) => {
    try {
        const { products, action = 'save-all', skipDuplicates = false, fileInfo } = req.body;

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有要保存的产品数据'
            });
        }

        console.log(`📝 开始批量保存报价: ${products.length} 条记录`);
        console.log(`📋 操作类型: ${action}`);
        console.log(`⚡ 跳过重复: ${skipDuplicates}`);

        const savedRecords = [];
        const errors = [];
        let skippedCount = 0;

        for (const productData of products) {
            try {
                // 数据格式转换和清理
                const quotationData = {
                    // 基本信息
                    name: productData.productName || productData.name,
                    productName: productData.productName || productData.name,
                    supplier: productData.vendor || productData.supplier,
                    
                    // 价格信息
                    list_price: productData.originalPrice || productData.list_price || null,
                    quote_unit_price: productData.unitPrice || productData.finalPrice || productData.quote_unit_price,
                    unit_price: productData.unitPrice || productData.unit_price || null,
                    quantity: productData.quantity || 1,
                    quote_total_price: Number(productData.finalPrice)||0,
                    totalPrice: Number(productData.finalPrice)||0,
                    discountedTotalPrice: productData.finalPrice || productData.discountedTotalPrice,
                    discount_rate: productData.discount ? (productData.discount * 100) : (productData.discount_rate || null),
                    
                    // 时间信息
                    quote_validity: productData.quotationDate || productData.quote_validity || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    delivery_date: productData.delivery_date || null,
                    
                    // 其他信息
                    currency: cleanCurrency(productData.currency) || 'EUR',
                    notes: productData.remark || productData.notes || '',
                    configDetail: productData.productSpec || productData.configDetail || '',
                    productSpec: productData.productSpec || productData.configDetail || '',
                    
                    // 分类信息
                    category: productData.category || '其他',
                    region: productData.region || '其他',
                    status: 'active',
                    
                    // 原始文件信息 (如果有)
                    ...(productData.originalFile ? { originalFile: productData.originalFile } : {}),
                    ...(fileInfo ? { 
                        originalFile: {
                            filename: fileInfo.fileName,
                            originalName: fileInfo.originalName || fileInfo.fileName,
                            path: fileInfo.filePath,
                            fileSize: fileInfo.size,
                            uploadedAt: new Date()
                        }
                    } : {})
                };

                // 检查重复 (如果需要)
                if (skipDuplicates) {
                    const existing = await Quotation.findOne({
                        productName: quotationData.productName,
                        supplier: quotationData.supplier,
                        quote_unit_price: quotationData.quote_unit_price
                    });

                    if (existing) {
                        console.log(`⏭️ 跳过重复记录: ${quotationData.productName}`);
                        skippedCount++;
                        continue;
                    }
                }

                const quotation = new Quotation(quotationData);
                const savedQuotation = await quotation.save();
                savedRecords.push(savedQuotation);

                console.log(`✅ 保存成功: ${quotationData.productName}`);

            } catch (error) {
                console.error(`❌ 保存失败: ${productData.productName || '未知产品'}:`, error);
                errors.push({
                    product: productData.productName || '未知产品',
                    error: error.message
                });
            }
        }

        const response = {
            success: true,
            message: `成功保存 ${savedRecords.length} 条记录${skippedCount > 0 ? `，跳过 ${skippedCount} 条重复记录` : ''}${errors.length > 0 ? `，失败 ${errors.length} 条` : ''}`,
            savedCount: savedRecords.length,
            skippedCount: skippedCount,
            errorCount: errors.length,
            data: savedRecords,
            errors: errors.length > 0 ? errors : undefined
        };

        console.log(`🎉 批量保存完成: 成功${savedRecords.length}条, 跳过${skippedCount}条, 失败${errors.length}条`);

        res.json(response);

    } catch (error) {
        console.error('❌ 批量保存报价失败:', error);
        res.status(500).json({
            success: false,
            message: '批量保存失败',
            error: error.message
        });
    }
});

// 手动上传文件存储
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        try { await fs.mkdir(uploadDir, { recursive: true }); cb(null, uploadDir);} catch(e){cb(e);} },
    filename: (req,file,cb)=>{ const unique=Date.now()+ '-' + Math.round(Math.random()*1e9); const ext=path.extname(file.originalname); cb(null, `manual-${unique}${ext}`); }
});
const upload = multer({ storage });

// 手动录入接口
router.post('/manual', upload.single('quotationFile'), async (req, res)=>{
    try {
        const fileInfo = req.file ? {
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            uploadedAt: new Date()
        }: null;

        const data = {
            productName: req.body.productName,
            name: req.body.productName,
            supplier: req.body.supplier,
            category: req.body.category || '其他',
            region: req.body.region,
            quote_total_price: Number(String(req.body.finalPrice).replace(/,/g, '')) || 0,
            totalPrice: Number(String(req.body.finalPrice).replace(/,/g, '')) || 0,
            currency: req.body.currency || 'CNY',
            quantity: Number(req.body.quantity) || 1,
            quote_validity: req.body.quoteValidity || new Date(),
            list_price: req.body.listPrice ? Number(String(req.body.listPrice).replace(/,/g, '')) : undefined,
            quote_unit_price: req.body.unitPrice ? Number(String(req.body.unitPrice).replace(/,/g, '')) :
                              (req.body.finalPrice ? Number(String(req.body.finalPrice).replace(/,/g, '')) / (Number(req.body.quantity) || 1) : undefined),
            notes: req.body.remark||'',
            configDetail: req.body.productSpec||'',
            originalFile: fileInfo
        };
        const saved = await Quotation.create(data);
        res.json({ success:true, message:'手动报价保存成功', data: saved });
    } catch(err){ console.error(err); res.status(500).json({ success:false, message: err.message}); }
});

module.exports = router; 