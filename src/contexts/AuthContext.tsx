import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { validateCredentials, AUTH_CONFIG, isSessionExpired, User } from '../config/auth';

interface AuthContextType {
    isAuthenticated: boolean;
    login: (username: string, password: string) => boolean;
    logout: () => void;
    currentUser: string | null;
    currentUserInfo: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [currentUserInfo, setCurrentUserInfo] = useState<User | null>(null);

    const logout = () => {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setCurrentUserInfo(null);
        
        // 清除本地存储
        localStorage.removeItem(AUTH_CONFIG.authStorageKey);
        localStorage.removeItem(AUTH_CONFIG.userStorageKey);
        localStorage.removeItem(AUTH_CONFIG.timestampStorageKey);
    };

    // 初始化时检查本地存储的登录状态
    useEffect(() => {
        const savedAuth = localStorage.getItem(AUTH_CONFIG.authStorageKey);
        const savedUser = localStorage.getItem(AUTH_CONFIG.userStorageKey);
        
        if (savedAuth === 'true' && savedUser && !isSessionExpired()) {
            setIsAuthenticated(true);
            setCurrentUser(savedUser);
            // 注意：这里无法恢复完整的用户信息，只能恢复显示名称
        } else {
            // 会话过期，清除所有数据
            logout();
        }
    }, []);

    const login = (username: string, password: string): boolean => {
        // 验证用户凭据
        const validUser = validateCredentials(username, password);

        if (validUser) {
            setIsAuthenticated(true);
            setCurrentUser(validUser.displayName);
            setCurrentUserInfo(validUser);
            
            // 保存到本地存储
            localStorage.setItem(AUTH_CONFIG.authStorageKey, 'true');
            localStorage.setItem(AUTH_CONFIG.userStorageKey, validUser.displayName);
            localStorage.setItem(AUTH_CONFIG.timestampStorageKey, Date.now().toString());
            
            return true;
        }
        
        return false;
    };

    const value: AuthContextType = {
        isAuthenticated,
        login,
        logout,
        currentUser,
        currentUserInfo
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