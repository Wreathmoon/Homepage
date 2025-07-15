import { request } from '../utils/request';

export const getAnnouncement = () => request('/announcement', { method: 'GET' });
export const postAnnouncement = (msg: string) => request('/announcement', { method: 'POST', data: { msg } }); 