// Global Toast Service for OHIF
// This provides consistent toast notifications across the application

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

class ToastService {
  private container: HTMLElement | null = null;
  private toasts: Map<string, HTMLElement> = new Map();

  constructor() {
    this.createContainer();
  }

  private createContainer() {
    // Create toast container if it doesn't exist
    this.container = document.getElementById('ohif-toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'ohif-toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 400px;
      `;
      document.body.appendChild(this.container);
    }
  }

  show(type: Toast['type'], title: string, message?: string, duration = 4000) {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toastElement = this.createToastElement(id, type, title, message);
    
    if (this.container) {
      this.container.appendChild(toastElement);
      this.toasts.set(id, toastElement);

      // Trigger animation
      setTimeout(() => {
        toastElement.style.transform = 'translateX(0)';
        toastElement.style.opacity = '1';
      }, 10);

      // Auto remove
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  private createToastElement(id: string, type: Toast['type'], title: string, message?: string): HTMLElement {
    const toast = document.createElement('div');
    toast.id = id;
    
    // Get colors based on type
    const colors = this.getColors(type);
    const icon = this.getIcon(type);

    toast.style.cssText = `
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease-out;
      pointer-events: auto;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 0 0 1px ${colors.border};
      background: ${colors.background};
      border: 2px solid ${colors.border};
      padding: 16px;
      max-width: 380px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="flex-shrink: 0; margin-top: 2px;">
          ${icon}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: ${message ? '4px' : '0'};">
            ${title}
          </div>
          ${message ? `<div style="font-size: 13px; color: rgba(255,255,255,0.9); line-height: 1.4;">${message}</div>` : ''}
        </div>
        <button 
          onclick="window.toastService?.remove('${id}')"
          style="
            flex-shrink: 0;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
            font-size: 12px;
          "
          onmouseover="this.style.backgroundColor='rgba(255,255,255,0.3)'"
          onmouseout="this.style.backgroundColor='rgba(255,255,255,0.2)'"
        >
          ×
        </button>
      </div>
    `;

    return toast;
  }

  private getColors(type: Toast['type']) {
    switch (type) {
      case 'success':
        return {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          border: 'rgba(16, 185, 129, 0.5)'
        };
      case 'error':
        return {
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          border: 'rgba(239, 68, 68, 0.5)'
        };
      case 'warning':
        return {
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          border: 'rgba(245, 158, 11, 0.5)'
        };
      case 'info':
        return {
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          border: 'rgba(59, 130, 246, 0.5)'
        };
      default:
        return {
          background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          border: 'rgba(107, 114, 128, 0.5)'
        };
    }
  }

  private getIcon(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>`;
      case 'error':
        return `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>`;
      case 'warning':
        return `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>`;
      case 'info':
        return `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>`;
      default:
        return `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>`;
    }
  }

  remove(id: string) {
    const toast = this.toasts.get(id);
    if (toast) {
      // Animate out
      toast.style.transform = 'translateX(100%)';
      toast.style.opacity = '0';
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        this.toasts.delete(id);
      }, 300);
    }
  }

  // Convenience methods
  success(title: string, message?: string, duration?: number) {
    return this.show('success', title, message, duration);
  }

  error(title: string, message?: string, duration?: number) {
    return this.show('error', title, message, duration);
  }

  warning(title: string, message?: string, duration?: number) {
    return this.show('warning', title, message, duration);
  }

  info(title: string, message?: string, duration?: number) {
    return this.show('info', title, message, duration);
  }
}

// Create global instance
const toastService = new ToastService();

// Make it globally accessible
(window as any).toastService = toastService;

export default toastService; 