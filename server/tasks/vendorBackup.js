const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const archiver = require('archiver');
const XLSX = require('xlsx');
const dayjs = require('dayjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation_system';
    await mongoose.connect(MONGODB_URI);
    const Vendor = require('../models/vendor');

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

    console.log('[VendorBackup] 备份完成:', zipPath);
    process.exit(0);
  } catch (err) {
    console.error('[VendorBackup] 备份失败:', err);
    process.exit(1);
  }
})(); 