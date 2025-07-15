import React, { useState, useEffect } from 'react';
import { Modal, Typography } from '@douyinfe/semi-ui';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useAuth } from '../contexts/AuthContext';

const { Text } = Typography;

const MaintenancePopup: React.FC = () => {
    const { status, remaining, msg } = useMaintenance();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) return null;

    const [dismissed, setDismissed] = useState(false);

    // 当状态变化时重置 dismissed
    useEffect(() => {
        if (status !== 'scheduled') {
            setDismissed(false);
        }
    }, [status]);

    const visible = status === 'scheduled' && !dismissed;

    return (
        <Modal
            title="系统维护预告"
            visible={visible}
            footer={null}
            onCancel={() => setDismissed(true)}
            maskClosable={true}
            closable={true}
        >
            <p>{msg || '系统即将进入维护模式，请尽快完成当前操作并保存数据。'}</p>
            <Text strong type="danger" style={{ fontSize: 24 }}>
                倒计时：{remaining} 秒
            </Text>
        </Modal>
    );
};

export default MaintenancePopup; 