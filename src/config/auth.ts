// 认证配置文件
// 您可以在这里修改用户凭据

export interface User {
    username: string;
    password: string;
    displayName: string;
    role?: string;
}

// 有效用户列表
export const VALID_USERS: User[] = [
    {
        username: 'CHINAUNICOM_ADMIN',
        password: 'admin_password01!',
        displayName: '管理员',
        role: 'admin'
    },
    {
        username: 'user',
        password: '123456',
        displayName: '普通用户',
        role: 'user'
    },
    // 您可以在这里添加更多用户
    // {
    //     username: 'yourname',
    //     password: 'yourpassword',
    //     displayName: '您的姓名',
    //     role: 'user'
    // }
];

// 认证配置
export const AUTH_CONFIG = {
    // 登录状态保持时间（毫秒）
    sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
    
    // 本地存储键名
    authStorageKey: 'quotation_auth',
    userStorageKey: 'quotation_user',
    timestampStorageKey: 'quotation_auth_timestamp',
    
    // 密码要求
    passwordMinLength: 6,
    usernameMinLength: 3,
};

// 验证用户凭据
export const validateCredentials = (username: string, password: string): User | null => {
    const user = VALID_USERS.find(
        u => u.username === username && u.password === password
    );
    return user || null;
};

// 检查会话是否过期
export const isSessionExpired = (): boolean => {
    const timestamp = localStorage.getItem(AUTH_CONFIG.timestampStorageKey);
    if (!timestamp) return true;
    
    const loginTime = parseInt(timestamp);
    const now = Date.now();
    
    return (now - loginTime) > AUTH_CONFIG.sessionTimeout;
}; 