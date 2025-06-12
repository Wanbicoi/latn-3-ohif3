import React, { createContext, useContext, useCallback, useEffect, ReactNode } from 'react';
import PropTypes from 'prop-types';
import { Toaster, toast } from '../components';

const NotificationContext = createContext(null);

export const useNotification = () => useContext(NotificationContext);

const NotificationProvider = ({ children, service }) => {
  const DEFAULT_OPTIONS = {
    title: '',
    message: '',
    duration: 5000,
    position: 'bottom-right', // Aligning to Sonner's positioning system
    type: 'info', // info, success, error
  };

  const show = useCallback(options => {
    const { title, message, duration, position, type, promise, action } = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    if (promise) {
      return toast.promise(promise, {
        loading: title || 'Loading...',
        success: (data: unknown) => (typeof message === 'function' ? message(data) : message),
        error: (err: unknown) => (typeof message === 'function' ? message(err) : message),
      });
    }

    const toastOptions: any = {
      duration,
      position,
      description: message,
    };

    // Add action button for all notifications if not provided
    if (!action) {
      toastOptions.action = {
        label: 'Close',
        onClick: (toastId) => toast.dismiss(toastId),
      };
    } else {
      toastOptions.action = action;
    }

    return toast[type](title, toastOptions);
  }, []);

  const hide = useCallback(id => {
    toast.dismiss(id);
  }, []);

  const hideAll = useCallback(() => {
    toast.dismiss();
  }, []);

  /**
   * Sets the implementation of a notification service that can be used by extensions.
   *
   * @returns void
   */
  useEffect(() => {
    if (service) {
      service.setServiceImplementation({ hide, show });
    }
  }, [service, hide, show]);

  return (
    <NotificationContext.Provider value={{ show, hide, hideAll }}>
      <Toaster position="bottom-right" />
      {children}
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const withNotification = Component => {
  return function WrappedComponent(props) {
    const notificationContext = useNotification();
    return (
      <Component
        {...props}
        notificationContext={notificationContext}
      />
    );
  };
};

export default NotificationProvider;
