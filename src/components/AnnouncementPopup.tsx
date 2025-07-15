import React, { useState, useEffect } from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { useAnnouncement } from '../contexts/AnnouncementContext';
import { useAuth } from '../contexts/AuthContext';

const AnnouncementPopup: React.FC = () => {
    const { msg, createdAt } = useAnnouncement();
    const { isAuthenticated, currentUser } = useAuth();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!msg || !createdAt || !isAuthenticated) return;
        const userKey = localStorage.getItem('user_username') || currentUser || 'unknown';
        const key = `announcement_seen_${createdAt}_${userKey}`;
        if (!localStorage.getItem(key)) {
            setVisible(true);
            localStorage.setItem(key, '1');
        }
    }, [msg, createdAt, isAuthenticated]);

    if (!visible) return null;

    return (
        <Modal
            title="系统公告"
            visible={visible}
            footer={null}
            onCancel={() => setVisible(false)}
            maskClosable
        >
            <div style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                {msg}
            </div>
        </Modal>
    );
};

export default AnnouncementPopup; 