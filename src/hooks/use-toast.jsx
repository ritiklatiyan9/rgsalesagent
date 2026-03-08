import { toast } from 'sonner';

// Simple wrapper hook used across the app for showing toasts
export function useToast() {
  return { toast };
}
