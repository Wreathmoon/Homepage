import { request } from '../utils/request';

export interface LogItem {
  _id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  collection: string;
  itemId?: string;
  operator: string;
  payload?: any;
  createdAt: string;
}

export interface LogResponse {
  success: boolean;
  data: LogItem[];
  total: number;
}

export async function getLogs(page = 1, pageSize = 20): Promise<LogResponse> {
  return request('/logs', {
    method: 'GET',
    headers: { 'x-role': 'admin' }, // 临时: 后端简易鉴权
    params: { page, pageSize }
  });
} 