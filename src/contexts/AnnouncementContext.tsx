import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAnnouncement } from '../services/announcement';

interface AnnState {
    msg: string;
    createdAt: number | null;
}

const AnnouncementContext = createContext<AnnState>({ msg: '', createdAt: null });

export const useAnnouncement = () => useContext(AnnouncementContext);

export const AnnouncementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AnnState>({ msg: '', createdAt: null });

    useEffect(() => {
        const fetch = async () => {
            try {
                const res: any = await getAnnouncement();
                if (res && res.success && res.data) {
                    setState(res.data);
                }
            } catch {}
        };
        fetch();
        const t = setInterval(fetch, 5000);
        return () => clearInterval(t);
    }, []);

    return <AnnouncementContext.Provider value={state}>{children}</AnnouncementContext.Provider>;
}; 