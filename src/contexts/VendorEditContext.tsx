import React, { createContext, useContext, useState } from 'react';
import type { Vendor } from '../services/vendor';

interface VendorEditContextProps {
    editVendor: Vendor | null;
    startEdit: (vendor: Vendor) => void;
    clearEdit: () => void;
    goToVendorList: () => void; // 页面跳转回列表
}

const VendorEditContext = createContext<VendorEditContextProps | undefined>(undefined);

export const useVendorEdit = () => {
    const ctx = useContext(VendorEditContext);
    if (!ctx) throw new Error('useVendorEdit must be used within VendorEditProvider');
    return ctx;
};

interface ProviderProps {
    children: React.ReactNode;
    goToVendorList: () => void;
    goToVendorAdd: () => void; // 跳转到录入页
}

export const VendorEditProvider: React.FC<ProviderProps> = ({ children, goToVendorList, goToVendorAdd }) => {
    // 初始化时尝试从 sessionStorage 恢复正在编辑的供应商
    const [editVendor, setEditVendor] = useState<Vendor | null>(() => {
        const stored = sessionStorage.getItem('edit_vendor');
        if (stored) {
            try { return JSON.parse(stored) as Vendor; } catch { /** ignore */ }
        }
        return null;
    });

    // 若恢复了 editVendor 则确保 is_edit_mode 标记存在
    if (editVendor && !sessionStorage.getItem('is_edit_mode')) {
        sessionStorage.setItem('is_edit_mode', 'true');
        sessionStorage.setItem('edit_vendor_id', editVendor._id || '');
    }

    // 开始编辑：写入状态并持久化
    const startEdit = (vendor: Vendor) => {
        console.log('▶️ startEdit', vendor);
        setEditVendor(vendor);
        sessionStorage.setItem('edit_vendor', JSON.stringify(vendor));
        sessionStorage.setItem('edit_vendor_id', vendor._id || '');
        sessionStorage.setItem('is_edit_mode', 'true');
        goToVendorAdd();
    };

    // 清除编辑：移除状态与持久化
    const clearEdit = () => {
        setEditVendor(null);
        sessionStorage.removeItem('edit_vendor');
        sessionStorage.removeItem('edit_vendor_id');
        sessionStorage.removeItem('is_edit_mode');
    };

    return (
        <VendorEditContext.Provider value={{ editVendor, startEdit, clearEdit, goToVendorList }}>
            {children}
        </VendorEditContext.Provider>
    );
}; 