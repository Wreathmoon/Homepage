// 全局 ResizeObserver 修复
export class ResizeObserverFix {
    private static applied = false;
    private static originalResizeObserver: typeof ResizeObserver | null = null;
    private static errorHandler: (event: Event) => void;
    private static rejectionHandler: (event: PromiseRejectionEvent) => void;

    static apply() {
        if (this.applied || typeof window === 'undefined') {
            return;
        }

        // 保存原始的 ResizeObserver
        this.originalResizeObserver = window.ResizeObserver;

        // 定义错误处理函数
        this.errorHandler = (event: Event) => {
            if (event instanceof ErrorEvent && event.message.includes('ResizeObserver')) {
                event.stopPropagation();
                event.preventDefault();
            }
        };

        this.rejectionHandler = (event: PromiseRejectionEvent) => {
            if (event.reason?.message?.includes('ResizeObserver')) {
                event.preventDefault();
            }
        };

        // 重写 ResizeObserver
        window.ResizeObserver = class extends this.originalResizeObserver! {
            constructor(callback: ResizeObserverCallback) {
                super((entries: ResizeObserverEntry[], observer: ResizeObserver) => {
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

        // 添加错误监听器
        window.addEventListener('error', this.errorHandler);
        window.addEventListener('unhandledrejection', this.rejectionHandler);

        this.applied = true;
    }

    static release() {
        if (!this.applied || typeof window === 'undefined') {
            return;
        }

        // 恢复原始的 ResizeObserver
        if (this.originalResizeObserver) {
            window.ResizeObserver = this.originalResizeObserver;
        }

        // 移除错误监听器
        window.removeEventListener('error', this.errorHandler);
        window.removeEventListener('unhandledrejection', this.rejectionHandler);

        this.applied = false;
        this.originalResizeObserver = null;
    }
} 