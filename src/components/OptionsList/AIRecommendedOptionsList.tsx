import React, { useState, useEffect } from 'react';
import { OptionData, useOptions } from 'providers/OptionsDataProvider';
import OptionCard from './OptionCard';
import { ChartStyles } from '../OptionsChart/colorUtils';
import CryptoSelector from '../CryptoSelector/CryptoSelector';
import { bybitClient } from '../../api/bybit';

// Helper function to determine if an option has poor Risk/Reward
const isPoorRR = (option: OptionData, currentPrice: number): boolean => {
  if (option.delta === null || option.delta === undefined) return true; // Cannot calculate if delta is missing

  const markPriceNum = option.markPrice !== null && option.markPrice !== undefined ? parseFloat(String(option.markPrice)) : NaN;
  if (isNaN(markPriceNum)) return true; // Cannot calculate if markPrice is not a valid number

  const intrinsic = option.type === 'call'
    ? Math.max(0, currentPrice - option.strike)
    : Math.max(0, option.strike - currentPrice);
  const timeValue = Math.max(0, markPriceNum - intrinsic);
  const timeValPct = (timeValue / (markPriceNum === 0 ? 1 : markPriceNum)) * 100; // Avoid division by zero
  const rrRaw = (Math.abs((option.delta || 0) * 100) - timeValPct);
  return rrRaw < -10;
};

interface AIRecommendedOptionsListProps {
  loadingMessage?: string;
  onPurchaseClick: (option: OptionData) => void;
}

const AIRecommendedOptionsList: React.FC<AIRecommendedOptionsListProps> = ({
  loadingMessage,
  onPurchaseClick,
}) => {
  const {
    callOptions,
    putOptions,
    expirations,
    selectedExpiry,
    setSelectedExpiry,
    currentPrice,
    loading,
    error,
    loadingMessage: loadingMessageFromProvider
  } = useOptions();

  const [selectedOptionType, setSelectedOptionType] = useState<'call' | 'put'>('call');
  
  // 暗号通貨の選択と価格データ管理
  const [selectedCrypto, setSelectedCrypto] = useState<'BTC' | 'ETH' | 'SOL'>('BTC');
  const [cryptoPrices, setCryptoPrices] = useState<{
    BTC: number;
    ETH: number;
    SOL: number;
  }>({
    BTC: 0,
    ETH: 0,
    SOL: 0
  });
  const [cryptoDataLoading, setCryptoDataLoading] = useState<boolean>(false);

  // 複数の暗号通貨のリアルタイム価格データを取得
  useEffect(() => {
    const fetchRealtimePrices = async () => {
      setCryptoDataLoading(true);
      try {
        // USDC建ての暗号通貨価格を取得（より正確な市場価格）
        const priceData = await bybitClient.getRealtimePrices(['BTCUSDC', 'ETHUSDC', 'SOLUSDC']);

        // 各暗号通貨の最新価格を設定
        setCryptoPrices({
          BTC: priceData['BTCUSDC'] || 0,
          ETH: priceData['ETHUSDC'] || 0,
          SOL: priceData['SOLUSDC'] || 0
        });
      } catch (error) {
        console.error('リアルタイム価格データの取得に失敗しました:', error);
      } finally {
        setCryptoDataLoading(false);
      }
    };

    fetchRealtimePrices();

    // 価格データを定期的に更新（30秒ごと）
    const intervalId = setInterval(fetchRealtimePrices, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const baseOptions = selectedOptionType === 'call' ? callOptions : putOptions;

  const filteredByExpiry = selectedExpiry === 'all'
    ? baseOptions
    : baseOptions.filter(option => option.expiry === selectedExpiry);

  let chartConditionOptions: OptionData[] = [];
  if (currentPrice !== null && currentPrice !== undefined) {
    chartConditionOptions = filteredByExpiry
      .filter(option => {
        return Math.abs(option.strike - (currentPrice || 0)) / (currentPrice || 1) < 0.2;
      })
      .filter(option => {
        return !isPoorRR(option, currentPrice || 0);
      })
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 15);
  }

  const recommendedPicks = chartConditionOptions.slice(0, 4);

  if (loading) {
    return <div className="text-center p-10 text-white">{loadingMessage || loadingMessageFromProvider || 'Loading options...'}</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">Error: {error}</div>;
  }

  if (expirations.length === 0 && !loading) {
    return <div className="text-center p-10 text-white">No options data available for the selected criteria.</div>;
  }

  return (
    <div className="ai-recommended-options">
      {/* Filters and Selector Controls */}
      <div className="control-wrapper mb-6 space-y-4">
        {/* Option Type (Call/Put) Filter Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedOptionType('call')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors text-white ${selectedOptionType !== 'call' ? 'bg-gray-700 hover:bg-gray-600' : ''}`}
            style={selectedOptionType === 'call' ? { backgroundColor: ChartStyles.colors.call } : {}}
          >
            Call Options
          </button>
          <button
            onClick={() => setSelectedOptionType('put')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors text-white ${selectedOptionType !== 'put' ? 'bg-gray-700 hover:bg-gray-600' : ''}`}
            style={selectedOptionType === 'put' ? { backgroundColor: ChartStyles.colors.put } : {}}
          >
            Put Options
          </button>
        </div>
        
        {/* Crypto Selector */}
        <div className="crypto-selector-wrapper">
          <CryptoSelector
            selectedCrypto={selectedCrypto}
            cryptoPrices={cryptoPrices}
            onChange={setSelectedCrypto}
            loading={cryptoDataLoading}
          />
        </div>

        {/* Expiry Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-700 pb-3">
          <button
            onClick={() => setSelectedExpiry('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${selectedExpiry === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            All
          </button>
          {expirations.map(exp => (
            <button
              key={exp}
              onClick={() => setSelectedExpiry(exp)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${selectedExpiry === exp ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {exp.substring(5)}
            </button>
          ))}
        </div>
      </div>

      {recommendedPicks.length === 0 && !loading && (
        <div className="text-center p-10 text-white">No recommended options found for {selectedExpiry === 'all' ? 'any expiry' : selectedExpiry} based on current criteria.</div>
      )}

      {/* Option Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {recommendedPicks.map(option => (
          <OptionCard
            key={option.symbol}
            option={option}
            underlyingPrice={currentPrice}
            onPurchaseClick={onPurchaseClick}
          />
        ))}
      </div>
    </div>
  );
};

export default AIRecommendedOptionsList;
