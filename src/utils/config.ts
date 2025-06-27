// 动态配置文件 - 自动适配不同环境
export class AppConfig {
    // 获取当前域名和端口
    static getCurrentHost(): string {
        if (typeof window === 'undefined') {
            return 'localhost';
        }
        return window.location.hostname;
    }
    
    // 检测是否是开发环境
    static isDevelopment(): boolean {
        return process.env.NODE_ENV === 'development' || 
               this.getCurrentHost() === 'localhost' || 
               this.getCurrentHost() === '127.0.0.1';
    }
    
    // 获取API服务器地址
    static getApiUrl(): string {
        // 优先使用环境变量
        if (process.env.REACT_APP_API_URL) {
            return process.env.REACT_APP_API_URL;
        }
        
        // 动态检测
        const host = this.getCurrentHost();
        
        if (this.isDevelopment()) {
            // 开发环境
            return 'http://localhost:3001';
        } else {
            // 生产环境 - 使用当前域名
            return `http://${host}:3001`;
        }
    }
    
    // 获取AI服务器地址
    static getAiServerUrl(): string {
        // 优先使用环境变量
        if (process.env.REACT_APP_AI_SERVER_URL) {
            return process.env.REACT_APP_AI_SERVER_URL;
        }
        
        // 动态检测
        const host = this.getCurrentHost();
        
        if (this.isDevelopment()) {
            // 开发环境
            return 'http://localhost:8080';
        } else {
            // 生产环境 - 使用当前域名
            return `http://${host}:8080`;
        }
    }
    
    // 打印当前配置（调试用）
    static printConfig(): void {
        console.log('🔧 应用配置信息:');
        console.log('📍 当前域名:', this.getCurrentHost());
        console.log('🏗️ 开发环境:', this.isDevelopment());
        console.log('🔌 API地址:', this.getApiUrl());
        console.log('🤖 AI服务器:', this.getAiServerUrl());
    }
}

// 导出配置常量
export const API_CONFIG = {
    API_URL: AppConfig.getApiUrl(),
    AI_SERVER_URL: AppConfig.getAiServerUrl(),
    IS_DEV: AppConfig.isDevelopment()
};

// 在开发模式下打印配置
if (AppConfig.isDevelopment()) {
    AppConfig.printConfig();
} 