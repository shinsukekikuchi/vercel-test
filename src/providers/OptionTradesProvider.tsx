import React, { createContext, useContext, useState, ReactNode } from 'react';

// Local context for placed option trades
export interface OptionTrade {
  orderId: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  qty: number;
  price?: number;
  time: number;
}

interface OptionTradesContextType {
  trades: OptionTrade[];
  addTrade: (trade: OptionTrade) => void;
}

const OptionTradesContext = createContext<OptionTradesContextType | undefined>(undefined);

export const useOptionTrades = (): OptionTradesContextType => {
  const ctx = useContext(OptionTradesContext);
  if (!ctx) throw new Error('useOptionTrades must be used within OptionTradesProvider');
  return ctx;
};

export const OptionTradesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [trades, setTrades] = useState<OptionTrade[]>(() => {
    try {
      const stored = localStorage.getItem('optionTrades');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addTrade = (trade: OptionTrade) => {
    setTrades(prev => {
      const next = [trade, ...prev];
      try { localStorage.setItem('optionTrades', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <OptionTradesContext.Provider value={{ trades, addTrade }}>
      {children}
    </OptionTradesContext.Provider>
  );
};
