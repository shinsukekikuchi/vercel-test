import axios from 'axios';
import { OptionData } from '../mockData/optionsMock';

// Bybit API のベースURL
const BYBIT_API_BASE_URL = 'https://api.bybit.com';

// 現在のBTC価格を取得
export const getCurrentBTCPrice = async (): Promise<number> => {
  try {
    const response = await axios.get(`${BYBIT_API_BASE_URL}/v5/market/tickers`, {
      params: {
        category: 'spot',
        symbol: 'BTCUSDT'
      }
    });

    if (response.data.retCode === 0 && response.data.result.list.length > 0) {
      return parseFloat(response.data.result.list[0].lastPrice);
    }
    throw new Error('Failed to retrieve BTC price information');
  } catch (error) {
    console.error('An error occurred while fetching BTC price:', error);
    throw error;
  }
};

// 利用可能なオプション満期日を取得
// すべての満期日のオプションデータを取得
export const getAllOptions = async (): Promise<{ calls: OptionData[], puts: OptionData[], expirations: string[], currentPrice: number }> => {
  try {
    // 満期日リストを取得
    const expirations = await getExpiryDates();
    
    // 現在のBTC価格を取得
    const currentPrice = await getCurrentBTCPrice();
    
    // 最初の満期日のオプションを取得 (デフォルト表示用)
    if (expirations.length === 0) {
      throw new Error('No expiration date data available');
    }
    
    const options = await getOptionsByExpiry(expirations[0]);
    
    // コールとプットに分ける
    const calls = options.filter(option => option.type === 'call');
    const puts = options.filter(option => option.type === 'put');
    
    return {
      calls,
      puts,
      expirations,
      currentPrice
    };
  } catch (error) {
    console.error('An error occurred while fetching option data:', error);
    throw error;
  }
};

export const getExpiryDates = async (): Promise<string[]> => {
  try {
    const response = await axios.get(`${BYBIT_API_BASE_URL}/v5/market/instruments-info`, {
      params: {
        category: 'option',
        baseCoin: 'BTC'
      }
    });

    if (response.data.retCode === 0) {
      // 満期日を抽出してユニークな値のみを取得
      const expiryDates = response.data.result.list
        .map((item: any) => item.deliveryDate)
        .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
        .sort();
      
      return expiryDates;
    }
    throw new Error('Failed to retrieve expiration date information');
  } catch (error) {
    console.error('An error occurred while fetching expiration dates:', error);
    throw error;
  }
};

// 特定の満期日のオプション取引情報を取得
export const getOptionsByExpiry = async (expiry: string): Promise<OptionData[]> => {
  try {
    // 満期日に関するオプション情報を取得
    const instrumentsResponse = await axios.get(`${BYBIT_API_BASE_URL}/v5/market/instruments-info`, {
      params: {
        category: 'option',
        baseCoin: 'BTC',
        expiryDate: expiry
      }
    });

    if (instrumentsResponse.data.retCode !== 0) {
      throw new Error('Failed to retrieve option information');
    }

    const instruments = instrumentsResponse.data.result.list;
    
    // オプションのティッカー情報を取得
    const tickersResponse = await axios.get(`${BYBIT_API_BASE_URL}/v5/market/tickers`, {
      params: {
        category: 'option',
        baseCoin: 'BTC'
      }
    });

    if (tickersResponse.data.retCode !== 0) {
      throw new Error('Failed to retrieve option price information');
    }

    const tickers = tickersResponse.data.result.list;
    
    // 現在のBTC価格を取得
    const currentPrice = await getCurrentBTCPrice();
    
    // オプションデータを構築
    const options: OptionData[] = [];
    
    for (const instrument of instruments) {
      // このオプションに対応するティッカー情報を取得
      const ticker = tickers.find((t: any) => t.symbol === instrument.symbol);
      if (!ticker) continue;
      
      // オプションタイプを判断（C=コール、P=プット）
      const type = instrument.optionsType === 'Call' ? 'call' : 'put';

      // ストライク価格を取得、無効な場合はデフォルト値を設定
      const strikeStr = instrument.strikePrice || '0';
      const strike = Number.isNaN(parseFloat(strikeStr)) ? 90000 : parseFloat(strikeStr);

      // マーク価格を取得、無効な場合はデフォルト値を設定
      const markPriceStr = ticker.markPrice || '0';
      const markPrice = Number.isNaN(parseFloat(markPriceStr)) ? 5000 : parseFloat(markPriceStr);
      
      // IVを取得、無効な場合はデフォルト値を使用
      const ivStr = ticker.iv || '0.5';
      const iv = Number.isNaN(parseFloat(ivStr)) ? 50 : parseFloat(ivStr) * 100; // パーセントに変換
      
      // Bybit APIでは正確なデルタ値が提供されていない場合があるため、簡易計算
      // 実際には精度の高いモデル（Black-Scholes等）を使用するべき
      let delta: number;
      
      if (type === 'call') {
        // コールオプションの場合、ストライクが現在価格より低いほどデルタは1に近く
        delta = strike < currentPrice 
          ? 0.9 - 0.4 * (Math.min(strike / currentPrice, 1) - 0.6) 
          : Math.max(0.05, 0.5 - 0.5 * ((strike - currentPrice) / currentPrice));
      } else {
        // プットオプションの場合、ストライクが現在価格より高いほどデルタは-1に近く（負の値）
        delta = strike > currentPrice 
          ? -0.9 + 0.4 * (Math.max(currentPrice / strike, 0.6) - 0.6) 
          : Math.min(-0.05, -0.5 + 0.5 * ((currentPrice - strike) / currentPrice));
      }
      
      // ガンマ値（デルタの変化率）の簡易計算
      // ATMに近いほど大きく、ITMやOTMほど小さい
      const normDist = Math.abs(strike - currentPrice) / currentPrice;
      const gamma = Math.max(0.0001, 0.01 * Math.exp(-5 * normDist * normDist));
      
      // 出来高と建玉を取得、無効な場合はデフォルト値を設定
      const volumeStr = ticker.volume24h || '100';
      const volume = Number.isNaN(parseFloat(volumeStr)) ? 100 : parseFloat(volumeStr);

      const openInterestStr = ticker.openInterest || '200';
      const openInterest = Number.isNaN(parseFloat(openInterestStr)) ? 200 : parseFloat(openInterestStr);

      // 24時間の変化率（Bybit APIから取得できない場合はランダム値）
      const volumeChange = Math.round(Math.random() * 30);
      const oiChange = Math.round(Math.random() * 20);
      
      options.push({
        symbol: `BTC-${expiry}-${strike}-${type.charAt(0).toUpperCase()}`, // symbol形式：BTC-YYMMDD-STRIKE-C/P
        strike,
        markPrice,
        iv,
        delta,
        gamma,
        volume,
        openInterest,
        type,
        expiry,
        volumeChange,
        oiChange
      });
    }
    
    // オプションデータを拡張（買い目度スコアなど）
    return enhanceOptionsData(options, currentPrice);
  } catch (error) {
    console.error('An error occurred while fetching option data:', error);
    throw error;
  }
};

// プレミアム異常値を計算する関数
const calculatePremiumAnomaly = (option: { markPrice: number, fairPremium?: number }): number => {
  try {
    if (!option.fairPremium || !option.markPrice || 
        Number.isNaN(option.fairPremium) || Number.isNaN(option.markPrice)) {
      return 0; // 無効な値の場合は異常なしとして返す
    }
    
    const fairPremium = Math.max(0.1, option.fairPremium); // 0分割を避ける
    const actualPremium = option.markPrice;
    
    // 理論価格と実際の価格の乖離率
    const anomalyRatio = (actualPremium - fairPremium) / fairPremium;
    
    // -100～100の範囲にスケール
    return Math.max(-100, Math.min(100, anomalyRatio * 100));
  } catch (error) {
    console.error('Error calculating premium anomaly:', error);
    return 0; // エラーの場合は異常なしとして返す
  }
};

// オプションデータに買い目度スコアなどの追加情報を付与
const enhanceOptionsData = (options: OptionData[], currentPrice: number): OptionData[] => {
  // 各オプションに対して購入目度を計算する関数
  const calculateBuyScore = (option: OptionData, currentBTCPrice: number): number => {
    try {
      // NaNチェック、不正な値があればデフォルト値を返す
      if (Number.isNaN(option.strike) || Number.isNaN(option.markPrice) || 
          Number.isNaN(option.delta) || Number.isNaN(option.volume)) {
        return 50; // デフォルトの中間値
      }

      // 現在価格からの距離
      const distanceFromCurrent = Math.abs(option.strike - currentBTCPrice);
      const distanceScore = Math.max(0, 100 - (distanceFromCurrent / 1000) * 10);

      // デルタスコア - 0.3-0.6の範囲が高評価
      const absOptionDelta = Math.abs(option.delta || 0);
      const deltaScore = absOptionDelta >= 0.3 && absOptionDelta <= 0.6 
        ? 100 
        : 50 * (1 - Math.abs(absOptionDelta - 0.45) / 0.45);

      // プレミアムスコア
      const fairPremium = Math.max(0.1, (option.delta || 0) * distanceFromCurrent * 0.1);
      const premiumScore = Math.max(0, 100 - Math.abs((option.markPrice || 0) - fairPremium) / fairPremium * 100);

      // 流動性スコア
      const volumeScore = Math.min(100, (option.volume || 0) / 10);

      // 総合スコア
      const totalScore = (
        distanceScore * 0.2 +
        deltaScore * 0.4 +
        premiumScore * 0.3 +
        volumeScore * 0.1
      );

      return Math.round(totalScore);
    } catch (error) {
      console.error('Error calculating buy score:', error);
      return 50; // エラーの場合は中間値を返す
    }
  };
  
  // マップ関数で各オプションに追加データを付与
  return options.map(option => {
    try {
      // NaNチェックと修正
      const sanitizedOption = {
        ...option,
        strike: Number.isNaN(option.strike) ? 90000 : option.strike,
        markPrice: Number.isNaN(option.markPrice) ? 5000 : option.markPrice,
        iv: Number.isNaN(option.iv) ? 50 : option.iv,
        delta: Number.isNaN(option.delta) ? (option.type === 'call' ? 0.5 : -0.5) : option.delta,
        gamma: Number.isNaN(option.gamma) ? 0.001 : option.gamma,
        volume: Number.isNaN(option.volume) ? 100 : option.volume,
        openInterest: Number.isNaN(option.openInterest) ? 200 : option.openInterest,
        volumeChange: option.volumeChange === undefined ? 0 : option.volumeChange,
        oiChange: option.oiChange === undefined ? 0 : option.oiChange
      };
      
      // 購入目度スコアを計算
      const buyScore = calculateBuyScore(sanitizedOption, currentPrice);

      // 理論価格の計算
      const fairPremium = Math.max(0.1, (sanitizedOption.delta || 0) * Math.abs(sanitizedOption.strike - (currentPrice || 0)) * 0.1);

      // プレミアム異常値
      const premiumAnomaly = calculatePremiumAnomaly({ 
        markPrice: sanitizedOption.markPrice || 0, 
        fairPremium: fairPremium 
      });

      // アラート情報
      const alerts = {
        isInDecisionZone: Math.abs(sanitizedOption.delta || 0) >= 0.3 && Math.abs(sanitizedOption.delta || 0) <= 0.6,
        isUnderpriced: premiumAnomaly < -30,
        isOverpriced: premiumAnomaly > 30,
        hasVolumeSpike: sanitizedOption.volumeChange > 50,
        hasOiSpike: sanitizedOption.oiChange > 30,
        hasImbalance: Math.abs(premiumAnomaly) > 40
      };

      return {
        ...sanitizedOption,
        buyScore,
        fairPremium,
        premiumAnomaly,
        alerts
      };
    } catch (error) {
      console.error('An error occurred while processing option data:', error);
      // エラー発生時は、最小限のデータを返す
      return {
        ...option,
        symbol: option.symbol || 'BTC-UNKNOWN',
        strike: option.strike || 90000,
        markPrice: option.markPrice || 5000,
        iv: option.iv || 50,
        delta: option.delta || (option.type === 'call' ? 0.5 : -0.5),
        gamma: option.gamma || 0.001,
        volume: option.volume || 100,
        openInterest: option.openInterest || 200,
        buyScore: 50,
        fairPremium: 5000,
        premiumAnomaly: 0,
        volumeChange: 0,
        oiChange: 0,
        alerts: {
          isInDecisionZone: false,
          isUnderpriced: false,
          isOverpriced: false,
          hasVolumeSpike: false,
          hasOiSpike: false,
          hasImbalance: false
        }
      };
    }
  });
};
