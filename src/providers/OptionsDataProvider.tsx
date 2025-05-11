import React, { createContext, useState, useEffect, useCallback, ReactNode, useContext } from 'react';
import { bybitClient } from '../api/bybit';
import {
  OptionInstrumentInfo,
  OptionTicker,
  GetInstrumentsInfoResult,
  BybitApiResponse,
  GetTickersResult,
} from '../api/bybit';

// Helper to safely parse float, returns undefined if invalid or zero-like
const safeParseFloat = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = parseFloat(String(value));
  return isNaN(num) ? undefined : num; // Return undefined for NaN
};

// Helper: Symbol stringからstrike priceを抽出
const extractStrikeFromSymbol = (symbol: string): number => {
  // Updated regex to be more robust for different formats if needed
  const match = symbol.match(/-(\d{4,})(?:-\d{1,2})?-(C|P)/); // Adjust regex based on actual symbol patterns
  return match ? parseFloat(match[1]) : NaN;
};

// Helper: deliveryTime (Unix ms string) を YYYY-MM-DD 形式に変換
const getExpiryDate = (deliveryTime: string): string => {
  const ts = Number(deliveryTime);
  if (isNaN(ts)) return 'Invalid Date'; // Handle case where deliveryTime is not a valid number string
  const date = new Date(ts);
  if (isNaN(date.getTime())) return 'Invalid Date'; // Handle invalid date object
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper: Fetch BTC Spot Price directly (restored standalone function)
const fetchBtcSpotPrice = async (): Promise<number | undefined> => {
  try {
    // Using the client if it has a spot ticker method, otherwise direct fetch
    // Assuming direct fetch for now based on previous structure
    const response = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT');
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (data.retCode === 0 && data.result?.list?.[0]?.lastPrice) {
      const price = safeParseFloat(data.result.list[0].lastPrice);
      console.log(`[DataProvider] Fetched BTC spot price directly: ${price ?? 'null'}`);
      return price; // Return number or undefined
    } else if (data.retCode !== 0) {
      console.warn('[DataProvider] Could not fetch BTC price from direct API call:', data.retMsg || 'Unknown error');
      return undefined;
    } else {
      console.warn('[DataProvider] BTC price data not found in direct API response.');
      return undefined;
    }
  } catch (err) {
    console.error('[DataProvider] Error fetching BTC price directly:', err);
    return undefined;
  }
};

export interface OptionData {
  symbol: string;
  strike: number;
  type: 'call' | 'put';
  expiry: string;
  markPrice?: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  openInterest?: number;
}

interface OptionsContextProps {
  callOptions: OptionData[];
  putOptions: OptionData[];
  expirations: string[];
  selectedExpiry: string;
  setSelectedExpiry: (expiry: string) => void;
  currentPrice: number | undefined;
  loading: boolean;
  error: string | null;
  loadingMessage: string | null;
  refreshData: () => void;
}

const OptionsContext = createContext<OptionsContextProps | undefined>(undefined);

export const OptionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [callOptions, setCallOptions] = useState<OptionData[]>([]);
  const [putOptions, setPutOptions] = useState<OptionData[]>([]);
  const [expirations, setExpirations] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('all');
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>('Initializing...');

  const loadOptionsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage('Loading options instruments and tickers...');
    console.log('[DataProvider] Loading options instruments and tickers...');

    try {
      let allInstruments: OptionInstrumentInfo[] = [];
      let cursor: string | undefined = undefined;
      let instrumentPageCount = 0;

      console.log('[DataProvider] Starting instrument fetch loop...');
      do {
        instrumentPageCount++;
        console.log(`[DataProvider] Fetching instrument page ${instrumentPageCount}, cursor: ${cursor ?? 'none'}`);
        const instrumentsResponse = await bybitClient.getOptionInstruments({
          baseCoin: 'BTC',
          limit: 500,
          cursor: cursor,
        });

        if (instrumentsResponse.retCode !== 0) {
          console.error(`[DataProvider] Error fetching instruments page ${instrumentPageCount}: ${instrumentsResponse.retMsg}`);
          throw new Error(`Failed to fetch instruments page ${instrumentPageCount}: ${instrumentsResponse.retMsg}`);
        }

        if (instrumentsResponse.result?.list) {
          allInstruments = allInstruments.concat(instrumentsResponse.result.list);
          console.log(`[DataProvider] Fetched ${instrumentsResponse.result.list.length} instruments on page ${instrumentPageCount}. Total so far: ${allInstruments.length}`);
        } else {
          console.warn(`[DataProvider] No instruments list found on page ${instrumentPageCount}.`);
        }

        cursor = instrumentsResponse.result?.nextPageCursor;

      } while (cursor);

      console.log(`[DataProvider] Finished instrument fetch loop. Total instruments fetched: ${allInstruments.length}`);

      // --- Fetch Tickers (Single Call) ---
      setLoadingMessage('Fetching tickers using baseCoin=BTC...');
      console.log('[DataProvider] Fetching all BTC option tickers using baseCoin=BTC...');
      let allTickers: OptionTicker[] = [];

      try {
        const tickerResponse = await bybitClient.getOptionTickers({ baseCoin: 'BTC' });
        console.log('[DataProvider] Raw response for baseCoin=BTC:', JSON.stringify(tickerResponse, null, 2));

        if (tickerResponse.retCode === 0 && tickerResponse.result?.list) {
          console.log(`[DataProvider] Successfully fetched ${tickerResponse.result.list.length} tickers using baseCoin=BTC.`);
          allTickers = tickerResponse.result.list;
        } else {
          console.warn(`[DataProvider] Failed to fetch tickers using baseCoin=BTC. retCode=${tickerResponse.retCode}, retMsg=${tickerResponse.retMsg}`);
        }
      } catch (error) {
        console.error('[DataProvider] Critical error fetching tickers using baseCoin=BTC:', error);
        setError('Failed to load ticker data (baseCoin).');
        setLoading(false);
        return; // Stop processing if ticker fetch fails critically
      }

      console.log(`[DataProvider] Total tickers fetched: ${allTickers.length}`); // Updated log message

      // Existing warning logic based on the new fetch method
      if (allTickers.length === 0 && allInstruments.length > 0) {
        console.warn(`[DataProvider] Fetched 0 tickers using baseCoin=BTC, despite having ${allInstruments.length} instruments.`);
      } else if (allTickers.length > 0 && allTickers.length < allInstruments.length) {
        // This case might happen if baseCoin fetch doesn't cover *all* possible instruments (e.g., different base coins exist)
        // Or if some instruments fetched initially are no longer active/tradable when tickers are fetched.
        console.warn(`[DataProvider] Fetched ${allTickers.length} tickers using baseCoin=BTC, which is less than the ${allInstruments.length} instruments found initially.`);
      }

      // Process the fetched tickers (if any)
      // Create a map with normalized symbol keys (strip settlement coin suffix like '-USDT' or '-BTC')
      const normalizeSymbol = (sym: string): string => sym.replace(/-(USDT|BTC)$/i, '');

      const tickerMap = new Map<string, OptionTicker>();
      allTickers.forEach((t) => {
        tickerMap.set(normalizeSymbol(t.symbol), t);
      });

      const rawDeliveryTimes = allInstruments.map(inst => inst.deliveryTime);
      console.log('[DataProvider] Raw Delivery Times from API (All Pages):', rawDeliveryTimes.length);

      const allOptions = allInstruments.map((inst): OptionData | undefined => {
        const ticker = tickerMap.get(normalizeSymbol(inst.symbol));
        const strike = extractStrikeFromSymbol(inst.symbol);
        const expiry = getExpiryDate(inst.deliveryTime);
        if (!ticker) {
          // Only log instruments whose normalized symbols are missing to reduce noise
          console.warn(`[DataProvider] Ticker not found for instrument (normalized=${normalizeSymbol(inst.symbol)}): ${inst.symbol}`);
          return undefined; // Skip if corresponding ticker not found
        }
        return {
          symbol: inst.symbol,
          strike: strike,
          type: inst.optionsType.toLowerCase() as 'call' | 'put',
          expiry: expiry,
          markPrice: safeParseFloat(ticker.markPrice),
          iv: safeParseFloat(ticker.markIv),
          delta: safeParseFloat(ticker.delta),
          gamma: safeParseFloat(ticker.gamma),
          theta: safeParseFloat(ticker.theta),
          bid: safeParseFloat(ticker.bid1Price),
          ask: safeParseFloat(ticker.ask1Price),
          volume: safeParseFloat(ticker.volume24h),
          openInterest: safeParseFloat(ticker.openInterest),
        };
      }).filter((opt): opt is OptionData => !!opt && !isNaN(opt.strike) && opt.strike > 0 && opt.expiry !== 'Invalid Date');

      console.log(`[DataProvider] Processed ${allOptions.length} valid options data points.`);

      const calls = allOptions.filter(o => o.type === 'call');
      const puts = allOptions.filter(o => o.type === 'put');
      const rawExp = allOptions.map(o => o.expiry);

      console.log('[DataProvider] Processed Expiry Dates (before unique, all pages):', rawExp.length);

      const uniqueExp = Array.from(new Set(rawExp)).sort();

      console.log('[DataProvider] Final Unique Expiry Dates (All Pages):', uniqueExp);

      setCallOptions(calls);
      setPutOptions(puts);
      setExpirations(uniqueExp);
      if ((!uniqueExp.includes(selectedExpiry) || selectedExpiry === 'all') && uniqueExp.length) {
        console.log(`[DataProvider] Resetting selected expiry from ${selectedExpiry} to ${uniqueExp[0]}`);
        setSelectedExpiry(uniqueExp[0]);
      }
      console.log(`[DataProvider] Loaded ${calls.length} calls, ${puts.length} puts for ${uniqueExp.length} expirations (All Pages).`);
    } catch (err) {
      console.error('[DataProvider] Error loading options data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setCallOptions([]);
      setPutOptions([]);
      setExpirations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    const initialLoad = async () => {
      const price = await fetchBtcSpotPrice();
      if (price !== undefined) {
        setCurrentPrice(price);
      } else {
        setError("Failed to fetch initial BTC price.");
      }
      await loadOptionsData();
    };

    initialLoad();
  }, [loadOptionsData]);

  // Fetch BTC price periodically
  useEffect(() => {
    const fetchAndUpdatePrice = async () => {
      const price = await fetchBtcSpotPrice();
      if (price !== undefined) {
        setCurrentPrice(price);
      } else {
        console.warn("Periodic BTC price update failed.");
      }
    };

    const intervalId = setInterval(fetchAndUpdatePrice, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const refreshData = useCallback(async () => {
    console.log('[DataProvider] Refreshing options data...');
    setLoading(true);
    const price = await fetchBtcSpotPrice();
    if (price !== undefined) {
      setCurrentPrice(price);
    } else {
      console.warn("Refresh failed to update BTC price.");
    }
    await loadOptionsData();
  }, [loadOptionsData]);

  return (
    <OptionsContext.Provider value={{
      callOptions,
      putOptions,
      expirations,
      selectedExpiry,
      setSelectedExpiry,
      currentPrice,
      loading,
      error,
      loadingMessage,
      refreshData,
    }}>
      {children}
    </OptionsContext.Provider>
  );
};

export const useOptions = () => {
  const context = useContext(OptionsContext);
  if (context === undefined) {
    throw new Error('useOptions must be used within an OptionsProvider');
  }
  return context;
};
