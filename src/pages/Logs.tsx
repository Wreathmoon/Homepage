import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin, Button, Space, Toast } from '@douyinfe/semi-ui';
import { IconDownload } from '@douyinfe/semi-icons';
import { getLogs, LogItem } from '../services/log';
import { API_CONFIG } from '../utils/config';

const { Title } = Typography;

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchData = async (p: number) => {
    setLoading(true);
    try {
      const res = await getLogs(p, 20);
      if (res.success) {
        setLogs(res.data);
        setTotal(res.total);
        setPage(p);
      }
    } catch (err) {
      console.error('获取日志失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1); }, []);

  const columns = [
    { title: '时间', dataIndex: 'createdAt', width: 180 },
    { title: '动作', dataIndex: 'action', width: 100 },
    { title: '集合', dataIndex: 'collection', width: 120 },
    { title: '操作者', dataIndex: 'operator', width: 120 },
    {
      title: '内容',
      render: (record: LogItem) => JSON.stringify(record.payload || {})
    }
  ];

  // 导出日志
  const handleExportLogs = async () => {
    try {
      const resp = await fetch(`${API_CONFIG.API_URL}/api/logs/export?format=csv`, {
        headers: {
          'x-user': encodeURIComponent(localStorage.getItem('user_username') || ''),
          'x-user-role': 'admin'
        }
      });
      if (!resp.ok) throw new Error('导出失败');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logs_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      Toast.success('日志导出成功');
    } catch (err) {
      console.error('导出日志失败', err);
      Toast.error('导出日志失败');
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title heading={3} style={{ margin: 0 }}>系统日志</Title>
        <Button icon={<IconDownload />} onClick={handleExportLogs}>
          导出日志
        </Button>
      </Space>
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={logs}
          pagination={{
            currentPage: page,
            pageSize: 20,
            total,
            onPageChange: p => fetchData(p)
          }}
          scroll={{ x: 1000 }}
        />
      </Spin>
    </div>
  );
};

export default Logs; 