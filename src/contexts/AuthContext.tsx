import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { validateCredentials, AUTH_CONFIG, isSessionExpired, User } from '../config/auth';

interface AuthContextType {
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    currentUser: string | null;
    currentUserInfo: User | null;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [currentUserInfo, setCurrentUserInfo] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    const logout = () => {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setCurrentUserInfo(null);
        setIsAdmin(false);
        
        // 清除本地存储
        localStorage.removeItem('token');
        localStorage.removeItem(AUTH_CONFIG.authStorageKey);
        localStorage.removeItem(AUTH_CONFIG.userStorageKey);
        localStorage.removeItem(AUTH_CONFIG.timestampStorageKey);
        localStorage.removeItem('user_role');
    };

    // 初始化时检查本地存储的登录状态
    useEffect(() => {
        const savedAuth = localStorage.getItem(AUTH_CONFIG.authStorageKey);
        const savedUser = localStorage.getItem(AUTH_CONFIG.userStorageKey);
        const savedRole = localStorage.getItem('user_role');
        
        if (savedAuth === 'true' && savedUser && !isSessionExpired()) {
            setIsAuthenticated(true);
            setCurrentUser(savedUser);
            setIsAdmin(savedRole === 'admin');
            // 注意：这里无法恢复完整的用户信息，只能恢复显示名称
        } else {
            // 会话过期，清除所有数据
            logout();
        }
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            // 首先尝试API登录
            const { request } = await import('../utils/request');
            const result: any = await request('/auth/login', {
                method: 'POST',
                data: { username, password }
            });

            if (result && result.success) {
                // 兼容两种返回格式
                const userData = result.data?.user || result.data;
                const token = result.data?.accessToken || result.token;

                if (token) {
                    localStorage.setItem('token', token);
                }

                setIsAuthenticated(true);
                setCurrentUser(userData.displayName);
                setCurrentUserInfo(userData);
                setIsAdmin(userData.role === 'admin');
                
                // 保存到本地存储
                localStorage.setItem(AUTH_CONFIG.authStorageKey, 'true');
                localStorage.setItem(AUTH_CONFIG.userStorageKey, userData.displayName);
                localStorage.setItem(AUTH_CONFIG.timestampStorageKey, Date.now().toString());
                localStorage.setItem('user_role', userData.role);
                localStorage.setItem('user_username', userData.username);
                
                return true;
            }
        } catch (error) {
            console.warn('API登录失败，尝试本地验证:', error);
        }

        // 回退到本地验证
        const validUser = validateCredentials(username, password);
        if (validUser) {
            setIsAuthenticated(true);
            setCurrentUser(validUser.displayName);
            setCurrentUserInfo(validUser);
            setIsAdmin(validUser.role === 'admin');
            
            // 保存到本地存储
            localStorage.setItem(AUTH_CONFIG.authStorageKey, 'true');
            localStorage.setItem(AUTH_CONFIG.userStorageKey, validUser.displayName);
            localStorage.setItem(AUTH_CONFIG.timestampStorageKey, Date.now().toString());
            localStorage.setItem('user_role', validUser.role || 'user');
            localStorage.setItem('user_username', validUser.username);
            
            return true;
        }
        
        return false;
    };

    const value: AuthContextType = {
        isAuthenticated,
        login,
        logout,
        currentUser,
        currentUserInfo,
        isAdmin
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 