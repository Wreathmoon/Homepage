import { request } from '../utils/request';

export const getMaintenance = () => request('/maintenance', { method: 'GET' });
export const scheduleMaintenance = (delay: number, msg?: string) =>
  request('/maintenance/schedule', { method: 'POST', data: { delay, msg } });
export const stopMaintenance = () =>
  request('/maintenance/stop', { method: 'POST' }); 