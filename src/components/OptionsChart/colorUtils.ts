/**
 * ヒートマップのセル強度に基づいて色を返す関数
 * プライマリーカラーパレットを使用
 */
export function getIntensityColor(value: number, isBackground: boolean = false): string {
  if (value < 0.05) return isBackground ? '#13141b' : '#262738';
  if (value < 0.1) return '#f7f0ff'; // primary-50
  if (value < 0.2) return '#e9d9ff'; // primary-100
  if (value < 0.3) return '#d4b4ff'; // primary-200
  if (value < 0.4) return '#b78eff'; // primary-300
  if (value < 0.5) return '#9c6bff'; // primary-400
  if (value < 0.6) return '#804aff'; // primary-500
  if (value < 0.7) return '#6933f5'; // primary-600
  if (value < 0.8) return '#5626dc'; // primary-700
  if (value < 0.9) return '#4520b5'; // primary-800
  return '#361d86'; // primary-900
}

/**
 * ChartStyles - チャート用のスタイル定数を一元管理
 */
export const ChartStyles = {
  colors: {
    background: '#1A1A1C', // コアパレット: 背景
    gridLine: '#3F3F46',  // コアパレット: 枠線
    axis: '#F4F4F5',      // コアパレット: テキスト
    axisLabel: '#F4F4F5',  // コアパレット: テキスト
    label: '#F4F4F5',     // コアパレット: テキスト
    currentPrice: '#8B5CF6', // アクセント
    highlight: '#8B5CF6', // アクセント
    tooltip: '#F4F4F5',   // テキスト
    call: '#10B981',      // Call オプション
    put: '#EF4444',       // Put オプション
    legendText: '#F4F4F5', // テキスト
    intrinsic: '#8B5CF6',  // アクセント
    timeValue: '#8B5CF6',  // アクセント
    recommend: '#8B5CF6',  // アクセント
  },
  sizes: {
    fontSize: {
      small: 10,  // 小さいフォントサイズ
      normal: 12, // 標準フォントサイズ
      large: 14   // 大きいフォントサイズ
    },
    lineWidth: {
      thin: 1,    // 細い線
      normal: 1.5, // 標準線
      thick: 2     // 太い線
    },
    pointRadius: {
      small: 5,  // 小さいポイント
      normal: 7, // 標準ポイント
      large: 9   // 大きいポイント
    },
    dataPoint: {
      normal: 3,  // 標準データポイントサイズ
      selected: 5 // 選択時のデータポイントサイズ
    },
    strokeWidth: {
      thin: 1,    // 細い線
      medium: 1.5, // 中間の線
      thick: 2     // 太い線
    },
    borderRadius: 8, // 8px ラウンドで統一
  },
  // 強度に基づく色を返す関数
  getIntensityColor: function (intensity: number) {
    return getIntensityColor(intensity);
  }
};
