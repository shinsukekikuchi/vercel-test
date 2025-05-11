import React, { useState, useEffect } from 'react';
import OptionsChart from '../OptionsChart/OptionsChart';
import OptionTradePanel from '../OptionTradePanel';
import { OptionData, useOptions } from '../../providers/OptionsDataProvider'; // Consolidated import
import { useWallet } from '@solana/wallet-adapter-react';
import { useSnackbar } from '../SnackbarProvider';
import './OptionsVisualization.css';
import { ChartStyles } from '../OptionsChart/colorUtils';
import { bybitClient } from '../../api/bybit';
import CryptoSelector from '../CryptoSelector/CryptoSelector';

// 日付をフォーマットするヘルパー関数 (YYYY-MM-DD -> DD-MM-YY)
const formatExpiryDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T00:00:00Z'); // Assume UTC date
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date string');
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Get month as number (0-indexed + 1)
    const year = String(date.getUTCFullYear()).substring(2);
    return `${day}-${month}-${year}`;
  } catch (err) {
    console.error('Date formatting error:', dateStr, err);
    return dateStr || 'Invalid Date';
  }
};

const OptionsVisualization: React.FC = () => {
  const {
    callOptions,
    putOptions,
    expirations, // Use this for expiry dates
    currentPrice,
    selectedExpiry,
    setSelectedExpiry,
    loading,
    error,
  } = useOptions();

  // 暗号通貨の選択と価格データ管理のための状態
  const [selectedCrypto, setSelectedCrypto] = useState<'BTC' | 'ETH' | 'SOL'>('BTC');
  const [cryptoPrices, setCryptoPrices] = useState<{
    BTC: number;
    ETH: number;
    SOL: number;
  }>({
    BTC: currentPrice || 0,
    ETH: 0,
    SOL: 0
  });
  const [cryptoDataLoading, setCryptoDataLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'call' | 'put'>('call');
  const [filteredOptions, setFilteredOptions] = useState<OptionData[]>([]);
  const [tradePanelVisible, setTradePanelVisible] = useState<boolean>(false);
  const [selectedOptionDetail, setSelectedOptionDetail] = useState<OptionData | null>(null);

  // Wallet & Snackbar contexts for OptionTradePanel
  const wallet = useWallet();
  const { showSnackbar } = useSnackbar();

  // 初期化時に最初の満期日を選択
  useEffect(() => {
    // Use 'expirations' from the provider
    if (expirations && expirations.length > 0 && !selectedExpiry) {
      // If no expiry is selected yet, and expirations are available, select the first one.
      // The provider already sorts expirations and handles the 'all' case if needed.
      if (expirations[0] !== 'all') { // Ensure 'all' is not auto-selected if it's a placeholder
        setSelectedExpiry(expirations[0]);
      }
    } else if (expirations && expirations.length > 0 && selectedExpiry && !expirations.includes(selectedExpiry)) {
      // If current selectedExpiry is not in the list (e.g., after data refresh), select the first valid one.
      setSelectedExpiry(expirations[0] === 'all' && expirations.length > 1 ? expirations[1] : expirations[0]);
    }
  }, [expirations, selectedExpiry, setSelectedExpiry]);

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
        
        console.log('リアルタイム価格取得成功:', priceData);
      } catch (error) {
        console.error('リアルタイム価格データの取得に失敗しました:', error);
      } finally {
        setCryptoDataLoading(false);
      }
    };

    fetchRealtimePrices();

    // 価格データを定期的に更新（30秒ごと - より頻繁に更新）
    const intervalId = setInterval(fetchRealtimePrices, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // フィルタリングロジック
  useEffect(() => {
    const sourceOptions = activeTab === 'call' ? callOptions : putOptions;

    // 満期でフィルタリング
    let filtered = selectedExpiry === 'all'
      ? sourceOptions
      : sourceOptions.filter((opt: OptionData) => opt.expiry === selectedExpiry);

    setFilteredOptions(filtered);
  }, [activeTab, selectedExpiry, callOptions, putOptions]);

  // オプション選択ハンドラー
  const handleOptionSelect = (option: OptionData) => {
    setSelectedOptionDetail(option);
    setTradePanelVisible(true);
  };

  return (
    <div className="options-visualization-container">

      {/* Tab Switching */}
      <div className="flex justify-between items-center">
        <div className="tabs flex justify-center items-center space-x-1">
          <button
            className={`tab ${activeTab === 'call' ? 'active' : ''}`}
            onClick={() => setActiveTab('call')}
            style={activeTab === 'call' ? { backgroundColor: ChartStyles.colors.call, color: '#fff' } : {}}
          >
            Call Options
          </button>
          <button
            className={`tab ${activeTab === 'put' ? 'active' : ''}`}
            onClick={() => setActiveTab('put')}
            style={activeTab === 'put' ? { backgroundColor: ChartStyles.colors.put, color: '#fff' } : {}}
          >
            Put Options
          </button>
        </div>
        {/* 暗号通貨選択コンポーネント */}
        <CryptoSelector
          selectedCrypto={selectedCrypto}
          cryptoPrices={cryptoPrices}
          onChange={setSelectedCrypto}
          loading={cryptoDataLoading}
        />
      </div>

      {/* Date Selection Buttons */}
      <div className="date-selector">
        <button
          className={`date-button ${selectedExpiry === "all" ? "active" : ""}`}
          onClick={() => setSelectedExpiry("all")}
          disabled={loading}
        >
          All
        </button>

        {/* Use 'expirations' from the provider directly */}
        {expirations && expirations.length > 0 ? expirations.map((exp: string, index: number) => {
          // 満期日データのnullチェック
          if (!exp || exp === 'all') return null; // Skip 'all' if it's part of the list for UI buttons

          // 安全に日付をフォーマット
          const formattedDate = formatExpiryDate(exp);

          return (
            <button
              key={index} // expの代わりにindexを使用
              className={`date-button ${selectedExpiry === exp ? "active" : ""}`}
              onClick={() => setSelectedExpiry(exp)}
              disabled={loading}
            >
              {formattedDate}
            </button>
          );
        }) : <span className="no-data-message">Loading expiration date data...</span>}
      </div>

      {/* Options Chart */}
      <div className="chart-container">
        {filteredOptions && filteredOptions.length > 0 ? (
          <OptionsChart
            data={filteredOptions}
            currentPrice={cryptoPrices[selectedCrypto] || 0} // 選択された暗号通貨の価格を渡す
            cryptoSymbol={selectedCrypto} // 追加: 暗号通貨のシンボルも渡す
            width={800}
            height={500}
            onOptionSelect={handleOptionSelect}
          />
        ) : (
          <div className="no-data-container">
            <p>表示するデータがありません。他の満期日を選択してください。</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-indicator">Loading chart...</div>
      ) : error ? (
        <div className="error-message">Error loading chart data: {error}</div>
      ) : (
        tradePanelVisible && selectedOptionDetail && (
          <div className="option-trade-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setTradePanelVisible(false); setSelectedOptionDetail(null); } }}>
            <OptionTradePanel
              option={selectedOptionDetail}
              wallet={wallet}
              showSnackbar={showSnackbar}
              onClose={() => setTradePanelVisible(false)}
            />
          </div>
        )
      )}
    </div>
  );
};

export default OptionsVisualization;
