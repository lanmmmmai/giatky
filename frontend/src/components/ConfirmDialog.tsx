import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, Loader2, Trash2, X } from 'lucide-react';

type ConfirmVariant = 'default' | 'warning' | 'danger' | 'success';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  disableBackdropClose?: boolean;
  objectName?: string;
  onConfirm?: () => Promise<void> | void;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
  trigger: HTMLElement | null;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const variantStyles: Record<ConfirmVariant, { iconWrap: string; icon: string; button: string; Icon: typeof AlertTriangle }> = {
  default: {
    iconWrap: 'bg-neutral-100 text-neutral-900',
    icon: 'text-neutral-900',
    button: 'bg-neutral-900 hover:bg-neutral-800 focus-visible:ring-neutral-900',
    Icon: Info,
  },
  warning: {
    iconWrap: 'bg-amber-50 text-amber-700',
    icon: 'text-amber-700',
    button: 'bg-neutral-900 hover:bg-neutral-800 focus-visible:ring-neutral-900',
    Icon: AlertTriangle,
  },
  danger: {
    iconWrap: 'bg-red-50 text-red-600',
    icon: 'text-red-600',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600',
    Icon: Trash2,
  },
  success: {
    iconWrap: 'bg-emerald-50 text-emerald-700',
    icon: 'text-emerald-700',
    button: 'bg-neutral-900 hover:bg-neutral-800 focus-visible:ring-neutral-900',
    Icon: CheckCircle,
  },
};

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [loading, setLoading] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((result: boolean) => {
    setPending(current => {
      current?.resolve(result);
      requestAnimationFrame(() => current?.trigger?.focus());
      return null;
    });
    setLoading(false);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => (
    new Promise<boolean>((resolve) => {
      setPending({
        cancelText: 'Hủy',
        confirmText: 'Xác nhận',
        variant: 'default',
        ...options,
        resolve,
        trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      });
    })
  ), []);

  useEffect(() => {
    if (!pending) return;
    const focusTarget = pending.variant === 'danger' ? cancelRef.current : confirmRef.current;
    focusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!pending || loading) return;
      if (event.key === 'Escape' && !pending.disableBackdropClose) {
        event.preventDefault();
        close(false);
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, loading, pending]);

  const handleConfirm = async () => {
    if (!pending || loading) return;
    if (!pending.onConfirm) {
      close(true);
      return;
    }

    setLoading(true);
    try {
      await pending.onConfirm();
      close(true);
    } catch (_) {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!loading) close(false);
  };

  const variant = pending?.variant || 'default';
  const styles = variantStyles[variant];
  const Icon = styles.Icon;
  const titleId = 'confirm-dialog-title';
  const descriptionId = 'confirm-dialog-description';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 animate-in fade-in duration-150"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending.disableBackdropClose && !loading) {
              close(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-[520px] rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in zoom-in-95 fade-in duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${styles.iconWrap}`}>
                <Icon size={22} className={styles.icon} />
              </div>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="rounded-xl p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Đóng hộp xác nhận"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              <h2 id={titleId} className="text-xl font-bold leading-7 text-neutral-900">
                {pending.title}
              </h2>
              <p id={descriptionId} className="text-sm leading-6 text-neutral-600">
                {pending.description}
              </p>
              {pending.objectName && (
                <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900">
                  {pending.objectName}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending.cancelText}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-80 ${styles.button}`}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Đang xử lý...' : pending.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmDialogProvider');
  }
  return context.confirm;
};

