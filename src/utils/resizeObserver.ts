// 全局 ResizeObserver 修复
export class ResizeObserverFix {
    private static applied = false;

    static apply() {
        if (this.applied || typeof window === 'undefined') {
            return;
        }

        const RO = window.ResizeObserver;
        window.ResizeObserver = class extends RO {
            constructor(callback: any) {
                super((entries: any[], observer: any) => {
                    window.requestAnimationFrame(() => {
                        try {
                            callback(entries, observer);
                        } catch (e) {
                            // 只捕获 ResizeObserver 循环错误
                            if (!(e instanceof Error) || !e.message.includes('ResizeObserver')) {
                                throw e;
                            }
                        }
                    });
                });
            }
        };

        // 清理所有剩余的错误监听器
        const handleError = (event: Event | ErrorEvent) => {
            if (event instanceof ErrorEvent && event.message.includes('ResizeObserver')) {
                event.stopPropagation();
                event.preventDefault();
            }
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            if (event.reason?.message?.includes('ResizeObserver')) {
                event.preventDefault();
            }
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        this.applied = true;
    }
} 