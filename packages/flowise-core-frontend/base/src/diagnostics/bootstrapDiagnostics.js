const registerGlobalDiagnostics = () => {
    if (typeof window === 'undefined') {
        return;
    }

    const globalScope = window;

    if (globalScope.__UP_DIAGNOSTICS_INSTALLED__) {
        return;
    }

    globalScope.__UP_DIAGNOSTICS_INSTALLED__ = true;

    const logError = (type, payload) => {
        try {
            const timestamp = new Date().toISOString();
            // eslint-disable-next-line no-console
            console.error(`[bootstrap-${type}]`, { timestamp, ...payload });
        } catch (error) {
            // Fail silently if logging fails to avoid recursive exceptions
        }
    };

    globalScope.addEventListener('error', (event) => {
        logError('error', {
            message: event?.error?.message ?? event?.message,
            stack: event?.error?.stack,
            filename: event?.filename,
            lineno: event?.lineno,
            colno: event?.colno,
        });
    });

    globalScope.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason;
        logError('rejection', {
            message: typeof reason === 'object' ? reason?.message : reason,
            stack: reason?.stack,
            reason,
        });
    });
};

registerGlobalDiagnostics();

export {};
