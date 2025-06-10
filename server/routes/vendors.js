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

        if (region) query.region = region;
        if (type) query.type = type;
        if (status) query.status = status;

        // 代理类型筛选
        if (isGeneralAgent !== undefined) {
            query.isGeneralAgent = isGeneralAgent === 'true';
        }
        if (isAgent !== undefined) {
            query.isAgent = isAgent === 'true';
        }

        // 产品类别筛选
        if (productCategory) {
            query.category = { $in: [productCategory] };
        }

        // 关键字搜索 (名称、品牌、联系人)
        if (keyword) {
            query.$or = [
                { name: { $regex: keyword, $options: 'i' } },
                { brands: { $elemMatch: { $regex: keyword, $options: 'i' } } },
                { contact: { $regex: keyword, $options: 'i' } }
            ];
        }

        // 产品关键字搜索
        if (productKeyword) {
            query.brands = { $elemMatch: { $regex: productKeyword, $options: 'i' } };
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
        const vendor = new Vendor(req.body);
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

// 更新供应商信息
router.put('/:id', async (req, res) => {
    try {
        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            req.body,
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

// 删除供应商
router.delete('/:id', async (req, res) => {
    try {
        const vendor = await Vendor.findByIdAndDelete(req.params.id);

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: '供应商不存在'
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