import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin } from '@douyinfe/semi-ui';
import { getLogs, LogItem } from '../services/log';

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

  return (
    <div>
      <Title heading={3}>系统日志</Title>
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