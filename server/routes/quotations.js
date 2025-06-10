const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const Quotation = require('../models/quotation');

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
        if (category) query.category = category;
        if (region) query.region = region;
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
        const quotation = new Quotation(req.body);
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
        const quotation = await Quotation.findByIdAndUpdate(
            req.params.id,
            req.body,
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

        const filePath = quotation.originalFile.path;
        const fileName = quotation.originalFile.originalName || quotation.originalFile.filename;

        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                message: '文件不存在或已被删除'
            });
        }

        // 设置响应头
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // 发送文件
        res.sendFile(path.resolve(filePath));

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

        const filePath = attachment.path;
        const fileName = attachment.originalName || attachment.name;

        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                message: '文件不存在或已被删除'
            });
        }

        // 设置响应头
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');

        // 发送文件
        res.sendFile(path.resolve(filePath));

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

module.exports = router; 