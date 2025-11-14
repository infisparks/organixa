import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid'; // You may need to install this: npm install uuid

// Define the shape of a toast
interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'destructive' | 'default';
}

// Define the arguments for creating a new toast
type ToastArgs = Omit<Toast, 'id'>;

// Define the state and actions for the toast store
interface ToastState {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

// Create the store using zustand
const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, toast],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

/**
 * A simple function to be called from any component to show a toast.
 * This function generates a unique ID and adds the toast to the global store.
 */
export function toast(args: ToastArgs) {
  const id = uuidv4();
  useToastStore.getState().addToast({ id, ...args });
}

/**
 * A hook for React components (like the Toaster) to subscribe to the
 * list of toasts and get the action to remove them.
 */
export function useToasts() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  return { toasts, removeToast };
}