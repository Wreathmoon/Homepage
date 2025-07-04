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
    const [editVendor, setEditVendor] = useState<Vendor | null>(null);

    const startEdit = (vendor: Vendor) => { setEditVendor(vendor); goToVendorAdd(); };
    const clearEdit = () => setEditVendor(null);

    return (
        <VendorEditContext.Provider value={{ editVendor, startEdit, clearEdit, goToVendorList }}>
            {children}
        </VendorEditContext.Provider>
    );
}; 