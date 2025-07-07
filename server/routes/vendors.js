const express = require('express');
const router = express.Router();
const Vendor = require('../models/vendor');

// 获取供应商列表 (支持筛选和分页)
router.get('/', async (req, res) => {
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
                const predefinedAgentTypes = ['GENERAL_AGENT', 'AGENT', 'OEM'];
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

        // 产品关键字搜索
        if (productKeyword) {
            andConditions.push({
                brands: { $elemMatch: { $regex: productKeyword, $options: 'i' } }
            });
        }

        // 如果有复合条件，使用$and
        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        // 分页参数
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 执行查询
        const [vendors, total] = await Promise.all([
            Vendor.find(query)
                .sort({ createdAt: -1 })
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

// 添加新供应商
router.post('/', async (req, res) => {
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

        await Vendor.findByIdAndDelete(req.params.id);

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
router.put('/:id', async (req, res) => {
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

        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: '供应商不存在'
            });
        }

        res.json({
            success: true,
            message: '供应商更新成功',
            data: vendor
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

module.exports = router; 