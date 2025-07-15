import React, { useState, useEffect } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useAuth } from '../contexts/AuthContext';

const MaintenanceEndPopup: React.FC = () => {
    const { justEnded } = useMaintenance();
    const { isAuthenticated } = useAuth();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isAuthenticated && justEnded) {
            setVisible(true);
        }
    }, [justEnded, isAuthenticated]);

    if (!visible) return null;

    return (
        <Modal
            title="维护已结束"
            visible={visible}
            onCancel={() => setVisible(false)}
            footer={null}
            maskClosable={true}
        >
            系统维护已完成，您可以继续正常使用。
        </Modal>
    );
};

export default MaintenanceEndPopup; 