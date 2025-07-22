import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Toast } from '@douyinfe/semi-ui';
import { API_CONFIG } from './config';
import { AUTH_CONFIG } from '../config/auth';

// 只触发一次的登出标记
let isLoggingOut = false;

// API基础URL配置
const API_BASE_URL = API_CONFIG.API_URL + '/api';

// 创建 axios 实例
const request = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 增加到30秒
    withCredentials: true,          // 发送 httpOnly Cookie（refreshToken）
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
        
        // 统一日志所需的用户信息
        const displayName = localStorage.getItem(AUTH_CONFIG.userStorageKey);
        const role = localStorage.getItem('user_role');
        if (displayName && config.headers) {
            config.headers['x-user'] = encodeURIComponent(displayName);
        }
        if (role && config.headers) {
            config.headers['x-user-role'] = role;
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
    async (error: AxiosError<ErrorResponse>) => {
        const original = error.config as any;
        const status = error.response?.status;
        if (status === 401 && !original?._retry && sessionStorage.getItem('logged_out')!=='1') {
            original._retry = true;
            try {
                // 调用刷新接口（不带 Authorization）
                const resp = await axios.post<RefreshResp>(API_BASE_URL + '/auth/refresh', {}, { withCredentials: true });
                const newToken = resp.data.data?.accessToken;
                if (newToken) {
                    localStorage.setItem('token', newToken);
                    // 更新原请求 Authorization 头
                    original.headers = original.headers || {};
                    original.headers.Authorization = `Bearer ${newToken}`;
                    return request(original); // 重新发送原请求
                }
            } catch (e) {
                // 刷新失败，继续触发统一未授权处理
            }
        }

        // 刷新失败或再次 401，执行一次性登出
        if (status === 401 && !isLoggingOut && sessionStorage.getItem('logged_out')!=='1') {
            isLoggingOut = true;
            localStorage.removeItem('token');
            sessionStorage.setItem('logged_out', '1');
            Toast.error('登录已失效，请重新登录');
            setTimeout(() => {
                window.location.replace('/');
            }, 100);
        }
        const message = error.response?.data?.message || '请求失败，请稍后重试';
        Toast.error(message);
        return Promise.reject(error);
    }
);

// 自动刷新逻辑
interface RefreshResp { data: { accessToken: string } }

export { request }; 

