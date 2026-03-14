import { useEffect, useState, useCallback } from "react";

interface ToastMessage {
  id: number;
  text: string;
}

let addToastFn: ((text: string) => void) | null = null;

/** Show a toast message from anywhere. */
export function showToast(text: string) {
  addToastFn?.(text);
}

/** Toast container — mount once in App root. */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(({ id, text }) => (
        <div key={id} className="toast">{text}</div>
      ))}
    </div>
  );
}
