import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { bybitClient, GetOrderHistoryResult, OrderHistoryRecord, BybitApiResponse } from '../api/bybit';

interface OptionOrderHistoryContextType {
  history: OrderHistoryRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const OptionOrderHistoryContext = createContext<OptionOrderHistoryContextType | undefined>(undefined);

export const useOptionOrderHistory = (): OptionOrderHistoryContextType => {
  const ctx = useContext(OptionOrderHistoryContext);
  if (!ctx) throw new Error('useOptionOrderHistory must be used within OptionOrderHistoryProvider');
  return ctx;
};

export const OptionOrderHistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<OrderHistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: BybitApiResponse<{ list: OrderHistoryRecord[] }> = await bybitClient.getOptionOrderHistory();
      if (res.retCode === 0) {
        setHistory(res.result.list);
      } else {
        throw new Error(res.retMsg || 'Failed to fetch order history');
      }
    } catch (e: any) {
      setError(e.message || 'Unknown error fetching order history');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <OptionOrderHistoryContext.Provider value={{ history, loading, error, refresh: fetchHistory }}>
      {children}
    </OptionOrderHistoryContext.Provider>
  );
};
