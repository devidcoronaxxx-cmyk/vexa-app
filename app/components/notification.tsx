"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type NoticeType = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: number;
  type: NoticeType;
  title: string;
  message?: string;
  duration?: number;
};

type ModalNotice = {
  open: boolean;
  type: NoticeType;
  title: string;
  message?: string;
  buttonText?: string;
};

type NotifyContextType = {
  notify: (input: {
    type?: NoticeType;
    title: string;
    message?: string;
    duration?: number;
  }) => void;
  notifyModal: (input: {
    type?: NoticeType;
    title: string;
    message?: string;
    buttonText?: string;
  }) => void;
  closeModal: () => void;
};

const NotifyContext = createContext<NotifyContextType | null>(null);

function getTypeColors(type: NoticeType) {
  switch (type) {
    case "success":
      return {
        bg: "rgba(34,197,94,0.14)",
        border: "rgba(34,197,94,0.28)",
        iconBg: "linear-gradient(135deg, #22c55e, #16a34a)",
        icon: "bi-check-lg",
      };
    case "error":
      return {
        bg: "rgba(239,68,68,0.14)",
        border: "rgba(239,68,68,0.28)",
        iconBg: "linear-gradient(135deg, #ef4444, #dc2626)",
        icon: "bi-x-lg",
      };
    case "warning":
      return {
        bg: "rgba(245,158,11,0.14)",
        border: "rgba(245,158,11,0.28)",
        iconBg: "linear-gradient(135deg, #f59e0b, #d97706)",
        icon: "bi-exclamation-lg",
      };
    default:
      return {
        bg: "rgba(252,216,70,0.14)",
        border: "rgba(252,216,70,0.28)",
        iconBg: "linear-gradient(135deg, #fcd846, #fcd846)",
        icon: "bi-info-lg",
      };
  }
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<ModalNotice>({
    open: false,
    type: "info",
    title: "",
    message: "",
    buttonText: "Okay",
  });

  const idRef = useRef(1);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({
      type = "info",
      title,
      message,
      duration = 3200,
    }: {
      type?: NoticeType;
      title: string;
      message?: string;
      duration?: number;
    }) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      window.setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const notifyModal = useCallback(
    ({
      type = "info",
      title,
      message,
      buttonText = "Okay",
    }: {
      type?: NoticeType;
      title: string;
      message?: string;
      buttonText?: string;
    }) => {
      setModal({
        open: true,
        type,
        title,
        message,
        buttonText,
      });
    },
    []
  );

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  const value = useMemo(
    () => ({
      notify,
      notifyModal,
      closeModal,
    }),
    [notify, notifyModal, closeModal]
  );

  const modalColors = getTypeColors(modal.type);

  return (
    <NotifyContext.Provider value={value}>
      {children}

      <div style={styles.toastWrap}>
        {toasts.map((toast) => {
          const colors = getTypeColors(toast.type);

          return (
            <div key={toast.id} style={{ ...styles.toastCard, background: colors.bg, borderColor: colors.border }}>
              <div style={{ ...styles.bigIconCircle, background: colors.iconBg }}>
                <i className={`bi ${colors.icon}`} style={{ fontSize: 18, color: "#fff" }} />
              </div>

              <div style={styles.toastText}>
                <div style={styles.toastTitle}>{toast.title}</div>
                {toast.message ? <div style={styles.toastMessage}>{toast.message}</div> : null}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                style={styles.closeBtn}
                aria-label="Close notification"
              >
                <i className="bi bi-x" />
              </button>
            </div>
          );
        })}
      </div>

      {modal.open ? (
        <div style={styles.overlay}>
          <button
            type="button"
            aria-label="Close modal"
            onClick={closeModal}
            style={styles.overlayBackdrop}
          />
          <div style={{ ...styles.modalCard, borderColor: modalColors.border }}>
            <div style={{ ...styles.modalIconCircle, background: modalColors.iconBg }}>
              <i className={`bi ${modalColors.icon}`} style={{ fontSize: 24, color: "#fff" }} />
            </div>

            <div style={styles.modalTitle}>{modal.title}</div>
            {modal.message ? <div style={styles.modalMessage}>{modal.message}</div> : null}

            <div style={styles.modalActions}>
              <button type="button" onClick={closeModal} style={styles.modalButton}>
                {modal.buttonText || "Okay"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    throw new Error("useNotify must be used inside NotificationProvider");
  }
  return ctx;
}

const styles: Record<string, React.CSSProperties> = {
  toastWrap: {
    position: "fixed",
    top: "max(16px, env(safe-area-inset-top))",
    right: "max(16px, env(safe-area-inset-right))",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    zIndex: 9999,
    width: "min(380px, calc(100vw - 24px))",
    pointerEvents: "none",
  },
  toastCard: {
    pointerEvents: "auto",
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    border: "1px solid",
    borderRadius: 18,
    background: "rgba(15, 23, 42, 0.92)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
    animation: "fadeUpIn 0.22s ease",
  },
  bigIconCircle: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
  },
  toastText: {
    flex: 1,
    minWidth: 0,
  },
  toastTitle: {
    color: "var(--text-primary, #f8fafc)",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.25,
    marginBottom: 4,
  },
  toastMessage: {
    color: "var(--text-secondary, #cbd5e1)",
    fontSize: 12.5,
    lineHeight: 1.5,
  },
  closeBtn: {
    border: "none",
    background: "transparent",
    color: "var(--text-tertiary, #94a3b8)",
    cursor: "pointer",
    padding: 4,
    fontSize: 16,
    lineHeight: 1,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  overlayBackdrop: {
    position: "absolute",
    inset: 0,
    border: "none",
    background: "rgba(3, 7, 18, 0.62)",
    backdropFilter: "blur(16px)",
    cursor: "pointer",
  },
  modalCard: {
    position: "relative",
    width: "min(460px, calc(100vw - 24px))",
    borderRadius: 24,
    border: "1px solid",
    background: "rgba(10, 14, 26, 0.94)",
    backdropFilter: "blur(22px)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
    padding: "22px 20px 18px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    animation: "scaleInSoft 0.2s ease",
  },
  modalIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text-primary, #f8fafc)",
    marginBottom: 8,
    letterSpacing: "-0.02em",
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 1.65,
    color: "var(--text-secondary, #cbd5e1)",
    marginBottom: 18,
    maxWidth: 380,
  },
  modalActions: {
    display: "flex",
    width: "100%",
    justifyContent: "center",
  },
  modalButton: {
    border: "1px solid var(--border-default, rgba(255,255,255,0.08))",
    background: "var(--surface-2, rgba(255,255,255,0.06))",
    color: "var(--text-primary, #f8fafc)",
    borderRadius: 12,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    minWidth: 110,
  },
};