import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Form, Row, Col, Button, Typography, Toast, Select, Switch, Space, DatePicker } from '@douyinfe/semi-ui';
import { TextArea } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { getVendorList } from '../../../services/vendor';

const { Title, Text } = Typography;

interface QuotationFormValues {
  supplier: string;
  product?: string;
  details?: string;
  endUserName?: string;
  endUserAddress?: string;
  endUserContact?: string;
  endUserContactInfo?: string;
  currency: string;
  isFirst: boolean;
  deliveryDate?: string;
  quoteValidityDate?: string;
}

const currencyOptions = [
  'CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'AUD', 'CAD', 'SGD', 'CHF', 'RUB', 'INR', 'KRW', 'THB', 'MYR', 'TWD', 'VND', 'IDR', 'BRL', 'ZAR', 'MXN', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'HUF', 'CZK', 'TRY', 'SAR', 'AED', 'ILS'
].map(cur => ({ label: cur, value: cur }));

// 简易防抖函数
function debounce<T extends (...args: any[]) => any>(func: T, wait = 300) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

const Quotation: React.FC = () => {
  const [mailContent, setMailContent] = useState('');
  const mailRef = useRef<HTMLTextAreaElement>(null);

  // 供应商下拉选项
  const [vendorOptions, setVendorOptions] = useState<{ label: string; value: string }[]>([]);

  // 加载默认供应商列表
  const loadInitialVendors = useCallback(async () => {
    try {
      const res = await getVendorList({ page: 1, pageSize: 20 });
      const opts = (res.data || []).map((v: any) => ({ label: v.name, value: v.name }));
      setVendorOptions(opts);
    } catch (e) {
      console.error('获取供应商失败', e);
    }
  }, []);

  useEffect(() => {
    loadInitialVendors();
  }, [loadInitialVendors]);

  // 远程搜索供应商
  const fetchVendors = useCallback(async (keyword: string) => {
    try {
      const res = await getVendorList({ keyword, page: 1, pageSize: 20 });
      const opts = (res.data || []).map(v => ({ label: v.name, value: v.name }));
      setVendorOptions(opts);
    } catch (e) {
      console.error('获取供应商失败', e);
    }
  }, []);

  // 防抖搜索
  const debouncedFetch = useCallback(debounce(fetchVendors, 300), [fetchVendors]);

  const handleGenerate = (values: QuotationFormValues) => {
    const {
      supplier, product, details, endUserName, endUserAddress,
      endUserContact, endUserContactInfo, currency, isFirst,
      deliveryDate, quoteValidityDate
    } = values;
    
    // 格式化日期
    const formatDate = (dateString?: string) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };
    
    let mail = `
Hi ${supplier},

I hope this email finds you well.

I'm reaching out to inquire about ${product ? product : '[specific service or product]'}.
We have a demand outlined as follows:

- ${details || '需求配置描述+需求数量'}

End-user: ${endUserName || 'xxx'}
Delivery Address: ${endUserAddress || '[Delivery Address Required]'}
${endUserContact ? `Contact Person: ${endUserContact}` : ''}${endUserContactInfo ? `, Contact Info: ${endUserContactInfo}` : ''}

Quotation Price Terms: Please provide DDP prices in ${currency}, excluding VAT. 
ETA: Kindly include the estimated delivery time.${deliveryDate ? ` Our required delivery date is ${formatDate(deliveryDate)}.` : ''}
Payment Terms: default payment term is invoice 30 days.
${quoteValidityDate ? `Quote Validity: Please ensure the quotation is valid until ${formatDate(quoteValidityDate)}.` : ''}

${isFirst ? `China Unicom operates through 37 entities globally, with our UK entity serving as the European HQ since 2006. Below, I have listed two relevant entities. Please confirm which one would be most suitable to proceed with for this project. Please kindly provide your contracting entity information as well, thank you.\n\nPO entities` : ''}
    `.trim();
    setMailContent(mail);
  };

  const handleCopy = () => {
    if (mailRef.current) {
      mailRef.current.select();
      document.execCommand('copy');
      Toast.success('邮件内容已复制到剪贴板');
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title heading={2}>询价邮件生成器</Title>
      <Form<QuotationFormValues>
        labelPosition="top"
        style={{ background: 'var(--semi-color-bg-1)', padding: 24, borderRadius: 8 }}
        onSubmit={handleGenerate}
        onSubmitFail={(errors) => {
          if (Array.isArray(errors) && errors.length > 0) {
            const first = errors[0] as any;
            const msg = typeof first === 'object' && first !== null && 'message' in first
              ? first.message
              : String(first);
            Toast.error(msg || '请检查表单必填项');
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Select
              field="supplier"
              label="供应商名字（必填）"
              placeholder="请选择或输入供应商名字"
              filter
              searchPosition="trigger"
              style={{ width: '100%' }}
              optionList={vendorOptions}
              dropdownClassName="vendor-select-dropdown"
              onSearch={(value) => {
                if (value) {
                  debouncedFetch(value);
                } else {
                  loadInitialVendors();
                }
              }}
              rules={[{ required: true, message: '请选择或输入供应商名字' }]}
            />
          </Col>
          <Col span={12}>
            <Form.Input
              field="product"
              label="产品名字"
              placeholder="请输入产品名字"
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Input
              field="endUserName"
              label="End-user 客户名"
              placeholder="请输入客户名"
            />
          </Col>
          <Col span={12}>
            <Form.Input
              field="endUserAddress"
              label="End-user 交付地址（必填）"
              placeholder="请输入交付地址"
              rules={[{ required: true, message: '请填写交付地址' }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Input
              field="endUserContact"
              label="End-user 联系人名"
              placeholder="请输入联系人名"
            />
          </Col>
          <Col span={12}>
            <Form.Input
              field="endUserContactInfo"
              label="End-user 联系人联系方式"
              placeholder="请输入联系人联系方式"
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Select
              field="currency"
              label="报价币种"
              placeholder="请选择币种"
              initValue="EUR"
              optionList={currencyOptions}
            />
          </Col>
          <Col span={12} style={{ display: 'flex', alignItems: 'center', marginTop: 24 }}>
            <Text style={{ marginRight: 12 }}>是否第一次向该供应商询价：</Text>
            <Form.Switch field="isFirst" initValue={true} checkedText="是" uncheckedText="否" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.DatePicker
              field="deliveryDate"
              label="需求交付日期（必填）"
              placeholder="请选择需求交付日期"
              style={{ width: '100%' }}
              format="yyyy-MM-dd"
              rules={[{ required: true, message: '请选择需求交付日期' }]}
            />
          </Col>
          <Col span={12}>
            <Form.DatePicker
              field="quoteValidityDate"
              label="报价有效期"
              placeholder="请选择报价有效期"
              style={{ width: '100%' }}
              format="yyyy-MM-dd"
            />
          </Col>
        </Row>
        <Row>
          <Col span={24}>
            <Form.TextArea
              field="details"
              label="需求配置详情"
              placeholder="请输入需求配置详情"
              autosize={{ minRows: 3, maxRows: 6 }}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
        <Row>
          <Col span={24} style={{ textAlign: 'center', margin: '32px 0 0 0' }}>
            <Button type="primary" htmlType="submit" size="large">生成邮件</Button>
          </Col>
        </Row>
      </Form>
      {mailContent && (
        <div style={{ margin: '40px auto 0 auto', maxWidth: 900, background: 'var(--semi-color-bg-1)', borderRadius: 8, padding: 32, position: 'relative' }}>
          <Title heading={4} style={{ textAlign: 'center' }}>生成的邮件内容</Title>
          <TextArea
            ref={mailRef}
            value={mailContent}
            onChange={setMailContent}
            autosize={{ minRows: 12, maxRows: 24 }}
            style={{ width: '100%', fontSize: 16, marginTop: 16, paddingRight: 48 }}
            placeholder="邮件内容将在这里生成，可编辑"
          />
          <Button
            icon={<IconCopy />}
            style={{ position: 'absolute', top: 32, right: 32, zIndex: 1 }}
            onClick={handleCopy}
            theme="borderless"
          />
        </div>
      )}
    </div>
  );
};

export default Quotation;