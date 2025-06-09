const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse'); // Import pdf-parse
const xlsx = require('xlsx'); // Import xlsx
const mammoth = require('mammoth'); // Import mammoth
const fs = require('fs').promises; // Import fs.promises for async file operations
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Import GoogleGenerativeAI

const app = express();
const db = new sqlite3.Database('./products.db');

// Access your API key - 直接配置以确保部署成功
const GEMINI_API_KEY = "AIzaSyBie3GiTRzEnNrrj-kne9NNXwvgqnkgt5A"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 配置CORS以允许前端连接
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true
}));
app.use(bodyParser.json());

console.log('🚀 正在启动报价管理系统后端服务器...');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = './uploads/';
        try {
            await fs.mkdir(uploadDir, { recursive: true }); // Ensure directory exists
            cb(null, uploadDir);
        } catch (error) {
            console.error('Error creating upload directory:', error);
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename
    }
});
const upload = multer({ storage: storage });

// 初始化表 - 修改为新字段并先删除旧表
db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS products`); // 清空当前数据库，删除旧表
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productName TEXT,
        vendor TEXT,
        category TEXT,
        region TEXT,
        productSpec TEXT,
        originalPrice REAL,
        finalPrice REAL,
        quantity INTEGER,
        discount REAL,
        quotationDate TEXT,
        remark TEXT,
        originalFile TEXT
    )`);
});

// 获取所有产品
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 新增产品
app.post('/api/products', (req, res) => {
    const { productName, vendor, category, region, productSpec, originalPrice, finalPrice, quantity, discount, quotationDate, remark } = req.body;
    db.run('INSERT INTO products (productName, vendor, category, region, productSpec, originalPrice, finalPrice, quantity, discount, quotationDate, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [productName, vendor, category, region, productSpec, originalPrice, finalPrice, quantity, discount, quotationDate, remark], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// 修改产品
app.put('/api/products/:id', (req, res) => {
    const { productName, vendor, category, region, productSpec, originalPrice, finalPrice, quantity, discount, quotationDate, remark } = req.body;
    db.run('UPDATE products SET productName=?, vendor=?, category=?, region=?, productSpec=?, originalPrice=?, finalPrice=?, quantity=?, discount=?, quotationDate=?, remark=? WHERE id=?', 
        [productName, vendor, category, region, productSpec, originalPrice, finalPrice, quantity, discount, quotationDate, remark, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// 删除产品
app.delete('/api/products/:id', (req, res) => {
    db.run('DELETE FROM products WHERE id=?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// API 1: 仅上传文件，不进行处理
app.post('/api/quotations/upload', upload.single('file'), async (req, res) => {
    console.log('📤 收到文件上传请求');
    
    if (!req.file) {
        return res.status(400).json({ error: '没有文件被上传' });
    }

    // 修复中文文件名编码
    let fileName = req.file.originalname;
    try {
        fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    } catch (e) {
        fileName = req.file.originalname;
    }
    
    console.log(`📁 文件上传成功: ${fileName}`); 
    console.log(`📂 文件路径: ${req.file.path}`);
    
    // 返回文件信息，供后续分析使用
    res.json({
        message: '文件上传成功！',
        fileInfo: {
            fileName: fileName,
            filePath: req.file.path,
            originalName: req.file.originalname,
            size: req.file.size,
            uploadTime: new Date().toISOString()
        }
    });
});

// API 2: 分析已上传的文件
app.post('/api/quotations/analyze', async (req, res) => {
    console.log('🔍 收到文件分析请求');
    const { filePath, fileName } = req.body;
    
    if (!filePath || !fileName) {
        return res.status(400).json({ error: '缺少文件路径或文件名' });
    }

    console.log(`📁 开始分析文件: ${fileName}`); 
    console.log(`📂 文件路径: ${filePath}`);
    
    const fileExtension = fileName.split('.').pop().toLowerCase();
    let extractedText = '';
    let productsToInsert = [];

    try {
        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({ error: '文件不存在或已过期' });
        }

        if (fileExtension === 'pdf') {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdf(dataBuffer);
            extractedText = data.text;
        } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            extractedText = xlsx.utils.sheet_to_txt(worksheet);
        } else if (fileExtension === 'docx') {
            const dataBuffer = await fs.readFile(filePath);
            const result = await mammoth.extractRawText({ arrayBuffer: dataBuffer });
            extractedText = result.value;
        } else {
            return res.status(400).json({ error: '不支持的文件格式。目前支持PDF、Excel和Word (.docx) 文件。' });
        }

        console.log('📄 文本提取完成 (前500字符):\n', extractedText.substring(0, 500) + '...');

        // Call large language model to process extractedText and get structured data
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash"});
        
        const prompt = `从以下报价文本中提取产品信息。以 JSON 数组的形式返回，每个产品一个对象。每个对象应包含以下字段：
        产品名称 (productName) - 必填，字符串。如果识别到文本描述的是服务器配件明细、"主机"或具体的服务器型号（如"PowerEdge R7625"），请不要展示各个配件信息，而是将其识别为一个服务器产品，产品名可以概括为"XX型号服务器报价"（例如："PowerEdge R7625 服务器报价"）。
        供应商 (vendor) - 必填，字符串。如果报价文本中没有明确的供应商名称，请尝试从文件名的括号中提取（例如：文件名"报价单（天耘）.pdf"中的"天耘"）。
        产品类别 (category) - 必填，字符串。请从以下选项中选择最合适的：服务器、存储设备、网络设备、安全设备、软件系统、云服务、其他。
        地区 (region) - 可选，字符串。请从以下选项中选择：德国、法国、英国、意大利、西班牙、荷兰、比利时、瑞士、奥地利、瑞典、挪威、丹麦、芬兰、波兰、捷克、匈牙利、葡萄牙、爱尔兰、希腊、其他。如果无法确定请设为null。
        产品规格 (productSpec) - 可选，字符串。产品的简要规格描述，例如"48口千兆交换机，4个10G上联口"。
        原始单价 (originalPrice) - 可选，数字。折扣前的单价。
        最终单价 (finalPrice) - 必填，数字。到手价/报价单价。对于服务器产品，请提供服务器整体的单价。
        数量 (quantity) - 必填，整数。对于服务器产品，请提供服务器的整体数量。
        折扣率 (discount) - 可选，数字。折扣率，例如0.9表示9折。
        报价日期 (quotationDate) - 必填，字符串 (日期格式，如YYYY-MM-DD)。
        备注 (remark) - 可选，字符串。如果项目是服务器，请将服务器的所有详细配置信息（例如处理器、内存、硬盘、RAID卡、网卡、电源等）整合并总结到此字段。对于非服务器产品，此字段可以为空。

        请注意：如果报价中同一台服务器的各个配件单独列出价格，请不要将每个配件作为单独的记录插入数据库。而是将这些配件的信息整合到该服务器记录的"备注"字段中，并确保该服务器只生成一条记录，其价格和数量反映服务器的整体信息。

        以下是一个服务器报价明细及其期望输出的示例：

        报价明细示例文本：
        """
        项目: 超融合集群
        PowerEdge R7625/3.5英寸 机箱 *1 $1000:
        2*AMD EPYC 9254 2.90GHz, 24C   $2000;
        12*16GB  $160;
        未配置 RAID *1 $100;
        PERC H755 适配器 全高 *1 100;
        系统盘: 2*480GB 固态硬盘 SATA *1 100;
        缓存盘: 2*1.92TB 固态硬盘 SATA *1 100;
        数据盘: 4*3.84TB 固态硬盘 SATA+8*4TB 硬盤 SATA 6Gbps 7.2K;
        双, 热插拔, 电源, 1100W MM (100-240Vac) Titanium, 冗余 (1+1);
        Broadcom 57414 双端口 10/25GbE SFP28, OCP NIC 3.0;
        Broadcom 5720 双端口 1GbE LOM;
        2*Broadcom 57414 双端口 10/25GbE SFP28 适配器, PCIe 全高, V2;
        6*戴尔 EMC PowerEdge SFP+ SR Optic 10GbE 850nm;
        WinStack超融合软件/iDRAC9, 企业 16G;
        ProSupport 和下一个工作日上门服务 Initial, 60个月;
        单价: US$19,720.00
        数量: 4
        总价: US$78,880.00
        有效期: 2024-12-31
        """

        期望的JSON输出示例：
        [ 
            { 
                "productName": "PowerEdge R7625 服务器报价", 
                "vendor": "天耘", 
                "category": "服务器",
                "region": null,
                "productSpec": "PowerEdge R7625/3.5英寸 机箱",
                "originalPrice": null, 
                "finalPrice": 19720.00, 
                "quantity": 4, 
                "discount": null, 
                "quotationDate": "2024-12-31", 
                "remark": "项目: 超融合集群; PowerEdge R7625/3.5英寸 机箱; 2*AMD EPYC 9254 2.90GHz, 24C; 12*16GB; 未配置 RAID; PERC H755 适配器 全高; 系统盘: 2*480GB 固态硬盘 SATA; 缓存盘: 2*1.92TB 固态硬盘 SATA; 数据盘: 4*3.84TB 固态硬盘 SATA+8*4TB 硬盤 SATA 6Gbps 7.2K; 双, 热插拔, 电源, 1100W MM (100-240Vac) Titanium, 冗余 (1+1); Broadcom 57414 双端口 10/25GbE SFP28, OCP NIC 3.0; Broadcom 5720 双端口 1GbE LOM; 2*Broadcom 57414 双端口 10/25GbE SFP28 适配器, PCIe 全高, V2; 6*戴尔 EMC PowerEdge SFP+ SR Optic 10GbE 850nm; WinStack超融合软件/iDRAC9, 企业 16G; ProSupport 和下一个工作日上门服务 Initial, 60个月;" 
            }
        ]
        
        如果无法识别某个必填字段，请将整个产品对象省略。如果可选字段无法识别，请将其设置为 null。如果无法提取任何产品，请返回一个空数组。
        
        报价文本：
        ${extractedText}`;

        console.log('🤖 发送prompt给Gemini进行分析...');

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('🤖 Gemini分析完成，响应长度:', text.length);

        // Attempt to parse the text as JSON. Handle cases where the model might output extra text.
        let parsedProducts = [];
        try {
            const jsonStartIndex = text.indexOf('[');
            const jsonEndIndex = text.lastIndexOf(']') + 1;
            if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
                const jsonString = text.substring(jsonStartIndex, jsonEndIndex);
                parsedProducts = JSON.parse(jsonString);
                console.log('✅ 成功解析产品数据，数量:', parsedProducts.length);
            } else {
                console.warn("❌ Gemini返回的JSON格式不正确:", text);
                return res.status(500).json({ error: '大模型返回格式不正确，无法解析产品数据。' });
            }
        } catch (jsonError) {
            console.error('❌ JSON解析错误:', jsonError);
            return res.status(500).json({ error: '解析大模型响应时发生错误。' });
        }

        // Filter out invalid items and map to required fields, and handle supplier from filename
        productsToInsert = parsedProducts.filter(p => 
            typeof p === 'object' && p !== null &&
            p.productName && typeof p.productName === 'string' &&
            p.vendor && typeof p.vendor === 'string' &&
            p.category && typeof p.category === 'string' &&
            p.finalPrice !== undefined && typeof p.finalPrice === 'number' &&
            p.quantity !== undefined && typeof p.quantity === 'number' &&
            p.quotationDate && typeof p.quotationDate === 'string'
        ).map(p => {
            // Attempt to extract supplier from filename if not explicitly found in text
            let finalSupplier = p.vendor;
            if (!p.vendor && fileName) {
                const match = fileName.match(/\((.*?)\)/);
                if (match && match[1]) {
                    finalSupplier = match[1];
                }
            }

            return {
                productName: p.productName,
                vendor: finalSupplier,
                category: p.category,
                region: p.region !== undefined ? p.region : null,
                productSpec: p.productSpec !== undefined ? p.productSpec : null,
                originalPrice: p.originalPrice !== undefined ? p.originalPrice : null,
                finalPrice: p.finalPrice,
                quantity: p.quantity,
                discount: p.discount !== undefined ? p.discount : null,
                quotationDate: p.quotationDate,
                remark: p.remark !== undefined ? p.remark : null,
                originalFile: filePath  // 保存原始文件路径
            };
        });

        console.log('💾 准备插入数据库的产品数量:', productsToInsert.length);

        if (productsToInsert.length === 0) {
            return res.status(200).json({ message: '文件分析完成，但未识别到有效产品数据。' });
        }

        // Insert products into database
        db.serialize(() => {
            console.log('💾 开始插入数据库...');
            const stmt = db.prepare('INSERT INTO products (productName, vendor, category, region, productSpec, originalPrice, finalPrice, quantity, discount, quotationDate, remark, originalFile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            productsToInsert.forEach(product => {
                stmt.run(
                    product.productName, 
                    product.vendor, 
                    product.category,
                    product.region,
                    product.productSpec,
                    product.originalPrice,
                    product.finalPrice,
                    product.quantity,
                    product.discount,
                    product.quotationDate,
                    product.remark,
                    product.originalFile,
                    function(err) {
                    if (err) {
                        console.error('❌ 数据库插入错误:', err.message);
                    } else {
                        console.log(`✅ 成功插入产品: ${product.productName} (ID: ${this.lastID})`);
                    }
                });
            });
            stmt.finalize();
            console.log('💾 数据库插入完成');
        });

        res.json({ 
            message: '文件分析完成！', 
            data: productsToInsert,
            fileInfo: {
                fileName: fileName,
                processedCount: productsToInsert.length
            }
        });

    } catch (error) {
        console.error('❌ 文件分析失败:', error);
        console.error('❌ 错误名称:', error.name);
        console.error('❌ 完整错误对象:', error);

        let errorMessage = '文件分析失败';
        if (error.name === 'GoogleGenerativeAIFetchError') {
            errorMessage = `大模型错误：${error.message}`;
        }

        res.status(500).json({ error: errorMessage });
    }
});

// API 3: 下载原始文件
app.get('/api/quotations/download/:id', (req, res) => {
    const quotationId = req.params.id;
    
    db.get('SELECT originalFile, productName FROM products WHERE id = ?', [quotationId], (err, row) => {
        if (err) {
            console.error('❌ 数据库查询错误:', err.message);
            return res.status(500).json({ error: '数据库查询失败' });
        }
        
        if (!row || !row.originalFile) {
            return res.status(404).json({ error: '找不到原始文件' });
        }
        
        const filePath = row.originalFile;
        const productName = row.productName || 'quotation';
        
        // 检查文件是否存在
        fs.access(filePath)
            .then(() => {
                // 获取文件扩展名
                const fileExtension = filePath.split('.').pop();
                const downloadFileName = `${productName}.${fileExtension}`;
                
                console.log(`📤 开始下载文件: ${downloadFileName}`);
                
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"`);
                res.setHeader('Content-Type', 'application/octet-stream');
                
                const fileStream = require('fs').createReadStream(filePath);
                fileStream.pipe(res);
                
                fileStream.on('error', (error) => {
                    console.error('❌ 文件读取错误:', error);
                    res.status(500).json({ error: '文件读取失败' });
                });
            })
            .catch(() => {
                res.status(404).json({ error: '原始文件不存在或已被删除' });
            });
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 报价管理系统后端服务器启动成功！`);
    console.log(`📡 端口: ${PORT}`);
    console.log(`🔗 访问地址: http://localhost:${PORT}`);
    console.log(`📤 文件上传端点: http://localhost:${PORT}/api/quotations/import`);
});