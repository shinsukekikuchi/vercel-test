import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type SnackbarType = 'success' | 'error' | 'info';

interface SnackbarContextType {
  showSnackbar: (message: string, type: SnackbarType) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const useSnackbar = (): SnackbarContextType => {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error('useSnackbar must be used within SnackbarProvider');
  return context;
};

export const SnackbarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [snack, setSnack] = useState<{ message: string; type: SnackbarType; open: boolean }>({ message: '', type: 'success', open: false });

  const showSnackbar = useCallback((message: string, type: SnackbarType) => {
    setSnack({ message, type, open: true });
    setTimeout(() => setSnack(prev => ({ ...prev, open: false })), 3000);
  }, []);

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      {snack.open && (
        <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow text-white ${
          snack.type === 'success' ? 'bg-green-500' : snack.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {snack.message}
        </div>
      )}
    </SnackbarContext.Provider>
  );
};
