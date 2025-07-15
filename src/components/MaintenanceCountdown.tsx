import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useAuth } from '../contexts/AuthContext';

const { Text } = Typography;

const pad = (n: number) => n.toString().padStart(2, '0');

const MaintenanceCountdown: React.FC = () => {
    const { status, remaining } = useMaintenance();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) return null;

    if (status === 'normal') return null;

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const text = status === 'scheduled' && remaining > 0 ? `维护倒计时 ${pad(minutes)}:${pad(seconds)}` : '维护中，请勿进行录入';

    return (
        <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: 'var(--semi-color-danger)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 4,
            boxShadow: '0 0 6px rgba(0,0,0,0.2)',
            zIndex: 2000
        }}>
            <Text strong style={{ color: '#fff' }}>{text}</Text>
        </div>
    );
};

export default MaintenanceCountdown; 