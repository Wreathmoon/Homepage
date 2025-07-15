import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getMaintenance } from '../services/maintenance';

export type MaintenanceStatus = 'normal' | 'scheduled' | 'maintenance';

interface MaintenanceState {
    status: MaintenanceStatus;
    /** 剩余秒数，仅在 scheduled 阶段有效 */
    remaining: number;
    /** 后端自定义提示信息 */
    msg: string;
    /** 维护结束时间戳 */
    lastEndedAt: number | null;
}

const MaintenanceContext = createContext<MaintenanceState>({
    status: 'normal',
    remaining: 0,
    msg: '',
    lastEndedAt: null
});

export const useMaintenance = () => {
    const ctx = useContext(MaintenanceContext);
    const justEnded = ctx.lastEndedAt ? Date.now() - ctx.lastEndedAt < 30_000 : false;
    return { ...ctx, justEnded };
};

interface ProviderProps {
    children: React.ReactNode;
}

export const MaintenanceProvider: React.FC<ProviderProps> = ({ children }) => {
    const [state, setState] = useState<MaintenanceState>({ status: 'normal', remaining: 0, msg: '', lastEndedAt: null });
    const deadlineRef = useRef<number | null>(null);

    // 5 秒轮询后端状态
    useEffect(() => {
        let polling: ReturnType<typeof setInterval>;
        const fetchStatus = async () => {
            try {
                const res: any = await getMaintenance();
                if (res && res.success && res.data) {
                    const { status, startAt, delay, msg, lastEndedAt } = res.data as {
                        status: MaintenanceStatus;
                        startAt: number | null;
                        delay: number;
                        msg: string;
                        lastEndedAt: number | null;
                    };

                    // 计算剩余秒数（scheduled 阶段）
                    let remaining = 0;
                    if (status === 'scheduled' && startAt) {
                        const endTime = startAt + delay * 1000;
                        remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
                        deadlineRef.current = endTime;
                    } else {
                        deadlineRef.current = null;
                    }

                    setState(prev => {
                        // 如果后端没有返回 lastEndedAt，但状态从 maintenance/scheduled 变为 normal，则补充
                        const derivedEndedAt = (status === 'normal' && prev.status !== 'normal' && !lastEndedAt)
                            ? Date.now() : lastEndedAt;
                        return { status, remaining, msg, lastEndedAt: derivedEndedAt || null };
                    });
                }
            } catch (e) {
                // ignore network errors
            }
        };

        fetchStatus();
        polling = setInterval(fetchStatus, 5000);
        return () => clearInterval(polling);
    }, []);

    // 本地倒计时（每秒）
    useEffect(() => {
        if (state.status !== 'scheduled') return;
        const timer: ReturnType<typeof setInterval> = setInterval(() => {
            setState(prev => {
                if (prev.status !== 'scheduled') return prev;
                const newRemain = prev.remaining - 1;
                return { ...prev, remaining: newRemain > 0 ? newRemain : 0 };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [state.status]);

    return (
        <MaintenanceContext.Provider value={state}>{children}</MaintenanceContext.Provider>
    );
}; 