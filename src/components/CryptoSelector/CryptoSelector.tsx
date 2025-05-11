import React from 'react';
import './CryptoSelector.css';

// 暗号通貨選択器のプロパティ定義
export interface CryptoSelectorProps {
  selectedCrypto: 'BTC' | 'ETH' | 'SOL';
  cryptoPrices: {
    BTC: number;
    ETH: number;
    SOL: number;
  };
  onChange: (crypto: 'BTC' | 'ETH' | 'SOL') => void;
  loading?: boolean;
}

/**
 * 暗号通貨選択コンポーネント
 * BTC、ETH、SOL間の切り替えボタンを表示
 */
const CryptoSelector: React.FC<CryptoSelectorProps> = ({ 
  selectedCrypto, 
  cryptoPrices, 
  onChange,
  loading = false 
}) => {
  return (
    <div className="crypto-selector">
      <button
        className={`crypto-button ${selectedCrypto === 'BTC' ? 'active' : ''}`}
        onClick={() => onChange('BTC')}
        disabled={loading}
      >
        BTC（${cryptoPrices.BTC.toLocaleString()}）
      </button>
      <button
        className={`crypto-button ${selectedCrypto === 'ETH' ? 'active' : ''}`}
        onClick={() => onChange('ETH')}
        disabled={loading}
      >
        ETH（${cryptoPrices.ETH.toLocaleString()}）
      </button>
      <button
        className={`crypto-button ${selectedCrypto === 'SOL' ? 'active' : ''}`}
        onClick={() => onChange('SOL')}
        disabled={loading}
      >
        SOL（${cryptoPrices.SOL.toLocaleString()}）
      </button>
    </div>
  );
};

export default CryptoSelector;
