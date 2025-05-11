import React, { useState, useEffect } from 'react';
import { getOrderHistory, clearOrderHistory } from '../utils/localStorageHistory';
import { RawOrderHistoryEntry } from '../types/orderHistory';
import './HistoryDisplayTable.css'; // We'll create this for styling

const HistoryDisplayTable: React.FC = () => {
  const [history, setHistory] = useState<RawOrderHistoryEntry[]>([]);
 
  useEffect(() => {
    const loadHistory = () => {
      // getOrderHistory() が返す配列をコピーしてからソートする
      const currentHistory = getOrderHistory();
      setHistory([...currentHistory].sort((a, b) => b.timestamp - a.timestamp)); // 新しい順にソート
    };

    loadHistory(); // 初回読み込み

    const handleStorageChange = () => {
        console.log('[HistoryDisplayTable] orderHistoryUpdated event received or storage changed.');
        loadHistory();
    };

    window.addEventListener('storage', handleStorageChange); // 他のタブでのlocalStorage変更を検知
    window.addEventListener('orderHistoryUpdated', handleStorageChange); // OptionTradePanelからのカスタムイベントを検知

    // クリーンアップ関数
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('orderHistoryUpdated', handleStorageChange);
    };
  }, []); // 依存配列は空のまま（イベントリスナーの登録・解除は一度だけでよいため）

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to delete all order history?')) {
      clearOrderHistory();
      setHistory([]); // Update state to reflect cleared history
    }
  };

  if (history.length === 0) {
    return <div className="p-4 text-gray-400">No order history found.</div>;
  }

  return (
    <div className="history-table-container p-4 bg-gray-800 text-gray-200">
      <div className="flex justify-end mb-2">
        <button 
          onClick={handleClearHistory}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
        >
          Clear History
        </button>
      </div>
      <table className="min-w-full history-table">
        <thead>
          <tr>
            <th>Market</th>
            <th>Product</th>
            <th>Order Type</th>
            <th>Direction</th>
            <th>Order Price</th>
            <th>Filled/Total Qty</th>
            <th>Order Value</th>
            {/* <th>TP/SL</th> */}
            <th>Trade Type</th>
            <th>Order Time</th>
            <th>Order ID</th>
            <th>Reduce-Only</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.internalId}>
              <td>{entry.symbol}</td>
              <td>{entry.productType}</td>
              <td>{entry.orderType}</td>
              <td className={entry.side === 'Buy' ? 'text-green-400' : 'text-red-400'}>
                {entry.side === 'Buy' ? 'Buy/Long' : 'Sell/Short'}
              </td>
              <td>{entry.price?.toFixed(2) ?? '--'}</td>
              <td>{`${entry.filledQuantity.toFixed(2)}/${entry.quantity.toFixed(2)} ${entry.baseAsset}`}</td>
              <td>{`${entry.orderValue.toFixed(2)} ${entry.quoteAsset}`}</td>
              {/* <td>--</td> */}
              <td>{entry.side === 'Buy' ? 'Buy Order' : 'Sell Order'}</td>
              <td>{formatTimestamp(entry.timestamp)}</td>
              <td>{entry.apiOrderId ? entry.apiOrderId.slice(0, 8) + '...' : entry.clientOrderId?.slice(0,8) + '...'}</td>
              <td>{entry.isReduceOnly ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryDisplayTable;
