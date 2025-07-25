const express = require('express');
const router = express.Router();
const Vendor = require('../models/vendor');
const { writeLog } = require('../services/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const checkVendorEdit = require('../middleware/checkVendorEdit');
const { body, query } = require('express-validator');
const validate = require('../middlewares/validator');
const requireRole = require('../middlewares/requireRole');
const archiver = require('archiver');
const XLSX = require('xlsx');
const dayjs = require('dayjs');

// 供应商附件上传存储配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const vendorId = req.params.id;
        const dir = path.join(__dirname, '..', 'uploads', 'vendors', vendorId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// 获取供应商列表 (支持筛选和分页)
router.get(
  '/',
  validate([
    query('keyword').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 })
  ]),
  async (req, res) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            region,
            type,
            keyword,
            productCategory,
            productKeyword,
            isGeneralAgent,
            isAgent,
            status
        } = req.query;

        // 构建查询条件
        let query = {};

        // 地区筛选（支持自定义）
        if (region) {
            if (region === 'OTHER' || region === '其他') {
                const predefinedRegions = ['美国', '中国', '韩国', '日本', '芬兰', '瑞典', '荷兰', '德国', '法国', '印度', '以色列', '加拿大', '澳大利亚', '台湾', '英国', '瑞士', '新加坡', '其他'];
                query.region = { $nin: predefinedRegions };
            } else {
                query.$or = [
                    { region: region },
                    { regions: region },
                    { regions: { $in: [region] } }
                ];
            }
        }

        // 供应商类型筛选（支持自定义）
        if (type) {
            if (type === 'OTHER' || type === '其他') {
                const predefinedTypes = ['HARDWARE', 'SOFTWARE', 'SERVICE', 'DATACENTER'];
                query.type = { $nin: predefinedTypes };
            } else {
                query.type = type;
            }
        }

        if (status) query.status = status;

        // 构建复合查询条件
        const andConditions = [];

        // 代理类型筛选（支持新的agentType字段和旧的布尔字段）
        if (req.query.agentType) {
            const agentType = req.query.agentType;
            if (agentType === 'OTHER' || agentType === '其他') {
                // 查找自定义代理类型（不在预设列表中的）
                const predefinedAgentTypes = ['GENERAL_AGENT', 'AGENT', 'OEM', 'CARRIER'];
                andConditions.push({
                    $or: [
                        // 新字段中的自定义类型
                        { 
                            agentType: { 
                                $exists: true, 
                                $nin: predefinedAgentTypes 
                            } 
                        },
                        // 旧布尔字段都为false（表示其他类型）
                        { 
                            $and: [
                                { $or: [{ agentType: { $exists: false } }, { agentType: null }] },
                                { isGeneralAgent: false },
                                { isAgent: false }
                            ]
                        }
                    ]
                });
            } else if (agentType === 'GENERAL_AGENT') {
                andConditions.push({
                    $or: [
                        { agentType: 'GENERAL_AGENT' },
                        { isGeneralAgent: true }
                    ]
                });
            } else if (agentType === 'AGENT') {
                andConditions.push({
                    $or: [
                        { agentType: 'AGENT' },
                        { isAgent: true }
                    ]
                });
            } else if (agentType === 'OEM') {
                andConditions.push({ agentType: 'OEM' });
            } else if (agentType === 'CARRIER') {
                andConditions.push({ agentType: 'CARRIER' });
            }
        } else {
            // 旧的布尔字段筛选（保持向后兼容）
            if (isGeneralAgent !== undefined) {
                query.isGeneralAgent = isGeneralAgent === 'true';
            }
            if (isAgent !== undefined) {
                query.isAgent = isAgent === 'true';
            }
        }

        // 产品类别筛选
        if (productCategory) {
            if (productCategory === '其他') {
                // 当筛选"其他"类别时，包括：
                // 1. 明确标记为"其他"的供应商
                // 2. 使用自定义产品类别的供应商（不在预设类别中）
                const predefinedCategories = ['服务器', '存储设备', '网络设备', '安全设备', '软件系统', '云服务', '其他'];
                
                andConditions.push({
                    $or: [
                        // 明确包含"其他"的供应商
                        { category: { $in: ['其他'] } },
                        // 包含自定义类别（不在预设列表中）的供应商
                        { 
                            category: { 
                                $elemMatch: { 
                                    $nin: predefinedCategories 
                                } 
                            } 
                        }
                    ]
                });
            } else {
                // 其他预设类别的正常筛选
                andConditions.push({
                    category: { $in: [productCategory] }
                });
            }
        }

        // 关键字搜索 (中文名、英文名、旧name、品牌、联系人)
        if (keyword) {
            andConditions.push({
                $or: [
                    { chineseName: { $regex: keyword, $options: 'i' } },
                    { englishName: { $regex: keyword, $options: 'i' } },
                    { name: { $regex: keyword, $options: 'i' } },
                    { brands: { $elemMatch: { $regex: keyword, $options: 'i' } } },
                    { contact: { $regex: keyword, $options: 'i' } }
                ]
            });
        }

        // 全局关键字搜索：品牌 / 产品类别 / 地区
        if (productKeyword) {
            const altKeywords = [productKeyword];
            if (productKeyword === '其他') altKeywords.push('OTHER');
            if (productKeyword === '硬件') altKeywords.push('HARDWARE');
            if (productKeyword === '软件') altKeywords.push('SOFTWARE');
            if (productKeyword === '服务') altKeywords.push('SERVICE');
            if (productKeyword === '数据中心') altKeywords.push('DATACENTER');
            if (productKeyword === '总代理') altKeywords.push('GENERAL_AGENT');
            if (productKeyword === '经销商') altKeywords.push('AGENT');
            if (productKeyword === '原厂') altKeywords.push('OEM');
            if (productKeyword === '运营商') altKeywords.push('CARRIER');

            const orList = [];
            altKeywords.forEach(kw => {
                const regex = { $regex: kw, $options: 'i' };
                orList.push(
                    { brands: { $elemMatch: regex } },
                    { category: { $elemMatch: regex } },
                    { region: regex },
                    { regions: { $elemMatch: regex } },
                    { type: regex },
                    { agentType: regex },
                    { code: regex },
                    { reportMethod: regex },
                    { remarks: regex },
                    { website: regex },
                    { address: regex }
                );
            });

            andConditions.push({ $or: orList });
        }

        // 如果有复合条件，使用$and
        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        // 排序参数
        const { sortField = 'englishName', sortOrder = 'asc' } = req.query;
        const sortOption = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

        // 分页参数
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 执行查询
        const [vendors, total] = await Promise.all([
            Vendor.find(query)
                .collation({ locale: 'zh' })
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
                .lean(),
            Vendor.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: vendors,
            total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize))
        });

    } catch (error) {
        console.error('获取供应商列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取供应商列表失败',
            error: error.message
        });
    }
});

// 获取供应商列表 (用于数据迁移)
router.get('/list',
  validate([
    query('keyword').optional().isString().trim()
  ]),
  async (req, res) => {
    try {
        const {
            keyword
        } = req.query;

        // 构建查询条件
        let query = {};

        // 关键字搜索 (中文名、英文名、旧name、品牌、联系人)
        if (keyword) {
            query.$or = [
                { chineseName: { $regex: keyword, $options: 'i' } },
                { englishName: { $regex: keyword, $options: 'i' } },
                { name: { $regex: keyword, $options: 'i' } },
                { brands: { $elemMatch: { $regex: keyword, $options: 'i' } } },
                { contact: { $regex: keyword, $options: 'i' } }
            ];
        }

        // 执行查询
        const vendors = await Vendor.find(query)
            .collation({ locale: 'zh' })
            .lean();

        res.json({
            success: true,
            data: vendors
        });

    } catch (error) {
        console.error('获取供应商列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取供应商列表失败',
            error: error.message
        });
    }
});

// 根据ID获取单个供应商
router.get('/:id', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
        
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: '供应商不存在'
            });
        }

        res.json({
            success: true,
            data: vendor
        });

    } catch (error) {
        console.error('获取供应商详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取供应商详情失败',
            error: error.message
        });
    }
});

// 添加新供应商（admin / user）
router.post(
  '/',
  requireRole(['admin', 'user']),
  validate([
    body('chineseName').isString().notEmpty().trim(),
    body('code').isString().notEmpty(),
    body('contact').isString().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('reportMethod').optional().isString().trim()
  ]),
  async (req, res) => {
    try {
        // 🔥 处理联系人数据和向后兼容
        const vendorData = { ...req.body };
        
        // 兼容字段映射
        if (!vendorData.chineseName && vendorData.name) {
            vendorData.chineseName = vendorData.name;
        }

        // 处理地区：支持 regions 数组
        if (vendorData.regions && Array.isArray(vendorData.regions) && vendorData.regions.length > 0) {
            // 写入旧region字段以兼容旧代码
            vendorData.region = vendorData.regions[0];
        } else if (vendorData.region) {
            vendorData.regions = [vendorData.region];
        } else {
            vendorData.regions = [];
        }

        // 如果有contacts数组，确保主要联系人信息同步到向后兼容字段
        if (vendorData.contacts && vendorData.contacts.length > 0) {
            const primaryContact = vendorData.contacts.find(c => c.isPrimary) || vendorData.contacts[0];
            if (primaryContact) {
                vendorData.contact = primaryContact.name;
                vendorData.phone = primaryContact.phone;
                vendorData.email = primaryContact.email;
            }
        }

        console.log('📝 保存供应商数据:', vendorData);
        
        const vendor = new Vendor(vendorData);
        await vendor.save();

        // 写日志
        writeLog({
            action: 'CREATE',
            collection: 'vendors',
            itemId: vendor._id,
            operator: req.headers['x-user'] ? decodeURIComponent(req.headers['x-user']) : 'unknown',
            payload: {
                chineseName: vendor.chineseName,
                englishName: vendor.englishName
            }
        });

        res.status(201).json({
            success: true,
            message: '供应商添加成功',
            data: vendor
        });

    } catch (error) {
        console.error('添加供应商失败:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: '数据验证失败',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        res.status(500).json({
            success: false,
            message: '添加供应商失败',
            error: error.message
        });
    }
});

// 删除供应商（管理员专用）
router.delete('/:id', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足，需要管理员权限'
            });
        }

        const vendor = await Vendor.findById(req.params.id);
        
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: '供应商不存在'
            });
        }

        const deleted = await Vendor.findByIdAndDelete(req.params.id);
        if (deleted) {
            writeLog({
                action: 'DELETE',
                collection: 'vendors',
                itemId: deleted._id,
                operator: req.headers['x-user'] ? decodeURIComponent(req.headers['x-user']) : 'unknown',
                payload: {
                    chineseName: deleted.chineseName,
                    englishName: deleted.englishName
                }
            });
        }

        res.json({
            success: true,
            message: '供应商删除成功'
        });

    } catch (error) {
        console.error('删除供应商失败:', error);
        res.status(500).json({
            success: false,
            message: '删除供应商失败',
            error: error.message
        });
    }
});

// 更新供应商信息
router.put('/:id', auth, async (req, res) => {
    // 管理员可修改全部；普通用户需有 vendorEditable 授权
    if (req.user.role !== 'admin') {
        const user = await require('../models/user').findOne({ username: req.user.username }).lean();
        const ve = user?.vendorEditable;
        const now = new Date();
        if (!(ve?.enabled && ve.expiresAt && ve.expiresAt > now)) {
            return res.status(403).json({ success: false, message: '没有修改全部供应商的权限' });
        }
    }
    try {
        const updateData = { ...req.body };

        if (!updateData.chineseName && updateData.name) {
            updateData.chineseName = updateData.name;
        }

        if (updateData.regions && Array.isArray(updateData.regions) && updateData.regions.length > 0) {
            updateData.region = updateData.regions[0];
        } else if (updateData.region) {
            updateData.regions = [updateData.region];
        }

        // 不允许覆盖首次录入信息
        delete updateData.entryPerson;
        delete updateData.entryTime;

        // 记录最后修改人
        updateData.modifiedBy = req.headers['x-user'] ? decodeURIComponent(req.headers['x-user']) : 'unknown';

        const updated = await Vendor.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (updated) {
            writeLog({
                action: 'UPDATE',
                collection: 'vendors',
                itemId: updated._id,
                operator: req.headers['x-user'] ? decodeURIComponent(req.headers['x-user']) : 'unknown',
                payload: {
                    chineseName: updated.chineseName,
                    englishName: updated.englishName
                }
            });
        }

        res.json({
            success: true,
            message: '供应商更新成功',
            data: updated
        });

    } catch (error) {
        console.error('更新供应商失败:', error);
        res.status(500).json({
            success: false,
            message: '更新供应商失败',
            error: error.message
        });
    }
});

// 用户自编辑供应商（需权限）
router.put('/:id/self', auth, async (req, res) => {
    try {
        const vendorId = req.params.id;
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, message: '供应商不存在' });
        }

        // 只能修改自己录入的供应商（兼容早期记录的 displayName）
        const UserModel = require('../models/user');
        const currentUser = await UserModel.findOne({ username: req.user.username }).lean();
        const displayName = currentUser?.displayName;

        if (
            vendor.entryPerson &&
            vendor.entryPerson !== req.user.username &&
            vendor.entryPerson !== displayName
        ) {
            return res.status(403).json({ success: false, message: '只能修改自己录入的供应商' });
        }

        Object.assign(vendor, req.body, { modifiedBy: req.user.username });
        await vendor.save();

        // 写日志（个人自编辑）
        writeLog({
            action: 'UPDATE',
            collection: 'vendors',
            itemId: vendor._id,
            operator: req.headers['x-user'] ? decodeURIComponent(req.headers['x-user']) : req.user.username,
            payload: {
                chineseName: vendor.chineseName,
                englishName: vendor.englishName
            }
        });

        res.json({ success: true, data: vendor });
    } catch (err) {
        console.error('用户自编辑供应商失败', err);
        res.status(500).json({ success: false, message: '内部错误' });
    }
});

// 获取供应商的产品信息
router.get('/:id/products', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
        
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: '供应商不存在'
            });
        }

        // 返回供应商的品牌和产品类别信息
        res.json({
            success: true,
            data: {
                brands: vendor.brands,
                categories: vendor.category,
                website: vendor.website,
                contact: vendor.contact
            }
        });

    } catch (error) {
        console.error('获取供应商产品失败:', error);
        res.status(500).json({
            success: false,
            message: '获取供应商产品失败',
            error: error.message
        });
    }
});

// 批量导入供应商数据 (用于数据迁移)
router.post('/batch-import', async (req, res) => {
    try {
        const { vendors } = req.body;
        
        if (!Array.isArray(vendors) || vendors.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供有效的供应商数据数组'
            });
        }

        const results = await Vendor.insertMany(vendors, { ordered: false });

        res.json({
            success: true,
            message: `成功导入 ${results.length} 个供应商`,
            data: results
        });

    } catch (error) {
        console.error('批量导入供应商失败:', error);
        res.status(500).json({
            success: false,
            message: '批量导入供应商失败',
            error: error.message
        });
    }
});

// 供应商手动备份（管理员）——仅在服务器保存 ZIP，不返回文件流
router.post('/backup', requireRole(['admin']), async (req, res) => {
  try {
    const vendors = await Vendor.find({}).lean();
    const rows = vendors.map(v => ({
      供应商编码: v.code || '',
      中文名称: v.chineseName || v.name || '',
      英文名称: v.englishName || '',
      供应商类型: v.type || '',
      代理类型: v.agentType || (v.isGeneralAgent ? 'GENERAL_AGENT' : v.isAgent ? 'AGENT' : 'OTHER'),
      国家地区: (v.regions || [v.region]).join(','),
      产品类别: Array.isArray(v.category) ? v.category.join(',') : '',
      代理品牌: (v.brands || []).join(','),
      售后故障联系: v.reportMethod || '',
      录入人: v.entryPerson || '',
      修改人: v.modifiedBy || '',
      创建时间: dayjs(v.createdAt).format('YYYY-MM-DD HH:mm:ss')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const month = dayjs().format('YYYY-MM');
    const dir = path.join(__dirname, '..', 'archived-vendors', month);
    fs.mkdirSync(dir, { recursive: true });
    const zipPath = path.join(dir, `vendors_${month}.zip`);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.append(buf, { name: `vendors_${month}.xlsx` });
    await archive.finalize();

    return res.json({ success: true, message: '备份完成', file: zipPath });
  } catch (err) {
    console.error('供应商备份失败', err);
    res.status(500).json({ success: false, message: '备份失败', error: err.message });
  }
});

/* ======================= 供应商附件相关接口 ======================= */

// 上传附件（支持多文件）
router.post('/:id/attachments', upload.array('files', 20), async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: '供应商不存在' });
        }

        const operator = req.headers['x-user'] ? decodeURIComponent(req.headers['x-user']) : 'unknown';

        const newFiles = req.files.map(file => {
            // 将 originalname 由 latin1 解码为 utf8，以解决中文文件名乱码
            let originalName = file.originalname;
            try {
                originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            } catch (e) {
                // fallback 原值
            }
            return {
                filename: file.filename,
                originalName,
                mimeType: file.mimetype,
                size: file.size,
                uploadedAt: new Date(),
                uploadedBy: operator
            };
        });

        vendor.attachments = [...(vendor.attachments || []), ...newFiles];
        await vendor.save();

        res.json({ success: true, message: '附件上传成功', data: vendor.attachments });
    } catch (error) {
        console.error('上传附件失败:', error);
        res.status(500).json({ success: false, message: '上传附件失败', error: error.message });
    }
});

// 获取附件列表
router.get('/:id/attachments', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id).lean();
        if (!vendor) {
            return res.status(404).json({ success: false, message: '供应商不存在' });
        }
        res.json({ success: true, data: vendor.attachments || [] });
    } catch (error) {
        console.error('获取附件列表失败:', error);
        res.status(500).json({ success: false, message: '获取附件列表失败', error: error.message });
    }
});

// 下载附件
router.get('/:id/attachments/:filename', async (req, res) => {
    try {
        const { id, filename } = req.params;
        const vendor = await Vendor.findById(id).lean();
        const attachment = vendor?.attachments?.find(a => a.filename === filename);
        const originalName = attachment?.originalName || filename;

        const filePath = path.join(__dirname, '..', 'uploads', 'vendors', id, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: '文件不存在' });
        }
        res.download(filePath, originalName);
    } catch (error) {
        console.error('下载附件失败:', error);
        res.status(500).json({ success: false, message: '下载附件失败', error: error.message });
    }
});

module.exports = router; 