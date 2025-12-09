import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastId = 0;
let listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function emitChange() {
  listeners.forEach(listener => listener(toasts));
}

export function toast(options: Omit<Toast, 'id'>) {
  const id = String(toastId++);
  const newToast = { ...options, id };
  toasts = [...toasts, newToast];
  emitChange();

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    emitChange();
  }, 5000);

  return id;
}

export function useToast() {
  const [state, setState] = useState<Toast[]>(toasts);

  useState(() => {
    listeners.push(setState);
    return () => {
      listeners = listeners.filter(l => l !== setState);
    };
  });

  const dismiss = useCallback((id: string) => {
    toasts = toasts.filter(t => t.id !== id);
    emitChange();
  }, []);

  return {
    toasts: state,
    toast,
    dismiss,
  };
}
