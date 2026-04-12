import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CallDrawerContext = createContext();

export function CallDrawerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [callData, setCallData] = useState(null);

  const openDrawer = useCallback((data) => {
    setCallData(data);
    setOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    // Let the drawer sliding animation finish before clearing data
    setTimeout(() => {
      setCallData(null);
    }, 400); 
  }, []);

  // For debugging visually in browser console
  useEffect(() => {
    window.testCallDrawer = (phone = "9876543210", duration = 90) => {
      openDrawer({
        phoneNumber: phone,
        duration: duration,
        callType: 'INCOMING',
        timestamp: new Date().toISOString()
      });
    };
    return () => {
      delete window.testCallDrawer;
    };
  }, [openDrawer]);

  return (
    <CallDrawerContext.Provider value={{ open, setOpen, callData, openDrawer, closeDrawer }}>
      {children}
    </CallDrawerContext.Provider>
  );
}

export function useCallDrawer() {
  const context = useContext(CallDrawerContext);
  if (!context) {
    throw new Error('useCallDrawer must be used within a CallDrawerProvider');
  }
  return context;
}
