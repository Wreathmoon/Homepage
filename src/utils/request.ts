
export interface RequestOptions extends Omit<RequestInit, 'headers'> {
    data?: any;
    mock?: boolean;
    params?: Record<string, any>;
    responseType?: 'json' | 'blob' | 'text';
}

interface MockData {
    [key: string]: any[];
}

// 模拟数据
const mockData: MockData = {
    '/api/products': [
        {
            id: 1,
            name: '服务器',
            supplier: '联想',
            list_price: 15000,
            quote_unit_price: 12000,
            quantity: 5,
            discount_rate: 0.8,
            quote_total_price: 60000,
            quote_validity: '2024-12-31',
            notes: 'ThinkSystem SR650 V2'
        }
    ],
    '/api/suppliers': [
        {
            id: 1,
            name: '联想',
            type: 'HARDWARE',
            isGeneralAgent: true,
            country: 'CN'
        }
    ]
};

export async function request(url: string, options: RequestOptions = {}) {
    // 如果启用mock数据
    if (options.mock && url in mockData) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
        return {
            data: mockData[url],
            total: mockData[url].length
        };
    }

    // 设置默认headers
    const headers = new Headers();
    
    // 如果不是FormData请求，设置Content-Type
    if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
        ...options,
        headers
    };

    if (options.data) {
        config.body = JSON.stringify(options.data);
    }

    try {
        const response = await fetch(url, config);
        if (options.body instanceof FormData) {
            return response;
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('请求错误:', error);
        throw error;
    }
} 
=======
import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Toast } from '@douyinfe/semi-ui';

// 创建 axios 实例
const request = axios.create({
    baseURL: process.env.REACT_APP_API_URL || '/api', // 从环境变量获取 API 地址
    timeout: 10000,
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

