import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Toast } from '@douyinfe/semi-ui';
import { API_CONFIG } from './config';

// API基础URL配置
const API_BASE_URL = API_CONFIG.API_URL + '/api';

// 创建 axios 实例
const request = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 增加到30秒
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器
request.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // 这里可以添加 token 等认证信息
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        // 如果是FormData，不要设置Content-Type，让浏览器自动设置
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        
        const uname = localStorage.getItem('user_username');
        const role = localStorage.getItem('user_role');
        if (uname && config.headers) {
            config.headers['x-user'] = uname;
        }
        if (role && config.headers) {
            config.headers['x-role'] = role;
        }
        
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

interface ErrorResponse {
    message?: string;
    [key: string]: any;
}

// 响应拦截器
request.interceptors.response.use(
    (response: AxiosResponse) => {
        return response.data;
    },
    (error: AxiosError<ErrorResponse>) => {
        const message = error.response?.data?.message || '请求失败，请稍后重试';
        Toast.error(message);
        return Promise.reject(error);
    }
);

export { request }; 

