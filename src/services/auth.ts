import { request } from '../utils/request';

export interface User {
    _id: string;
    username: string;
    displayName: string;
    role: 'admin' | 'user';
    isActive: boolean;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface RegistrationCode {
    _id: string;
    code: string;
    isUsed: boolean;
    usedBy?: string;
    usedAt?: string;
    expiresAt: string;
    createdBy: string;
    createdAt: string;
}

// 获取所有用户（管理员专用）
export const getAllUsers = async (): Promise<User[]> => {
    const response: any = await request('/auth/users', {
        method: 'GET',
        headers: {
            'x-user-role': localStorage.getItem('user_role') || '',
            'x-user-name': localStorage.getItem('user_username') || ''
        }
    });
    return response.data;
};

// 删除用户（管理员专用）
export const deleteUser = async (userId: string): Promise<void> => {
    await request('/auth/users/' + userId, {
        method: 'DELETE',
        headers: {
            'x-user-role': localStorage.getItem('user_role') || '',
            'x-user-name': localStorage.getItem('user_username') || ''
        }
    });
};

// 重置用户密码为默认值（管理员专用）
export const resetUserPassword = async (userId: string): Promise<void> => {
    await request('/auth/users/' + userId + '/reset-password', {
        method: 'PUT',
        headers: {
            'x-user-role': localStorage.getItem('user_role') || '',
            'x-user-name': localStorage.getItem('user_username') || ''
        }
    });
};

// 生成注册码（管理员专用）
export const generateRegistrationCode = async (): Promise<{ code: string; expiresAt: string }> => {
    const response: any = await request('/auth/registration-codes', {
        method: 'POST',
        headers: {
            'x-user-role': localStorage.getItem('user_role') || '',
            'x-user-name': localStorage.getItem('user_username') || ''
        }
    });
    return response.data;
};

// 获取注册码列表（管理员专用）
export const getRegistrationCodes = async (): Promise<RegistrationCode[]> => {
    const response: any = await request('/auth/registration-codes', {
        method: 'GET',
        headers: {
            'x-user-role': localStorage.getItem('user_role') || '',
            'x-user-name': localStorage.getItem('user_username') || ''
        }
    });
    return response.data;
};

// 删除注册码（管理员专用）
export const deleteRegistrationCode = async (codeId: string): Promise<void> => {
    await request(`/auth/registration-codes/${codeId}`, {
        method: 'DELETE',
        headers: {
            'x-user-role': localStorage.getItem('user_role') || '',
            'x-user-name': localStorage.getItem('user_username') || ''
        }
    });
};

// 修改密码
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    const username = localStorage.getItem('user_username');
    if (!username) {
        throw new Error('用户未登录');
    }

    await request('/auth/change-password', {
        method: 'POST',
        data: {
            username,
            oldPassword,
            newPassword
        }
    });
}; 