import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Toast } from '@douyinfe/semi-ui';

// 创建 axios 实例
const request = axios.create({
    baseURL: process.env.REACT_APP_API_URL || (
        process.env.NODE_ENV === 'production' 
            ? '/api'  // 生产环境使用相对路径
            : 'http://localhost:3001/api'  // 开发环境使用localhost
    ),
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

