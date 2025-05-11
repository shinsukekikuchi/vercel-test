// オプション取引のデータモデル
export interface OptionData {
  strike: number;        // ストライク価格
  markPrice?: number;    // マーク価格
  iv?: number;           // インプライド・ボラティリティ (%)
  delta?: number;        // デルタ値 (-1.0 ~ 1.0)
  gamma?: number;        // ガンマ値
  theta?: number;        // セータ値
  bid?: number;          // Bid 価格
  ask?: number;          // Ask 価格
  volume?: number;       // 取引量
  openInterest?: number; // 未決済約定数
  type: 'call' | 'put';  // オプションタイプ
  expiry: string;        // 満期日 (ISO形式)
  symbol: string;        // Bybit symbol (例: BTC-30JUN23-28000-C)
  // 追加項目
  buyScore?: number;     // 買い目度スコア (0-100)
  fairPremium?: number;  // デルタから計算した理論上妥当なプレミアム
  volumeChange?: number; // 24時間前からの取引量変化率 (%)
  oiChange?: number;     // 24時間前からの未決済約定数変化率 (%)
  premiumAnomaly?: number; // プレミアム異常値 (-100~100, マイナスは割安、プラスは割高)
  alerts?: {
    isInDecisionZone?: boolean;  // デルタが0.3～0.6の判断迷いゾーンにある
    isUnderpriced?: boolean;     // プレミアムが理論値より著しく安い
    isOverpriced?: boolean;      // プレミアムが理論値より著しく高い
    hasVolumeSpike?: boolean;    // 取引量が急増している
    hasOiSpike?: boolean;        // 未決済建玉数が急増してている
    hasImbalance?: boolean;      // デルタとプレミアムのバランスが崩れている
  };
}

// デフォルトのBTC現在価格 (モックデータとして使用される)
export const currentPrice = 93727;

// 買い目度スコア計算のヘルパー関数 (実際のプロダクションでは複雑なアルゴリズムを使用)
const calculateBuyScore = (option: Partial<OptionData>, currentPrice: number): number => {
  // 必要なプロパティが存在するか確認
  if (option.strike === undefined || option.delta === undefined || 
      option.markPrice === undefined || option.volume === undefined || 
      option.type === undefined) {
    return 50; // データ不足の場合は中間値を返す
  }
  
  // 実際はより複雑な計算が必要
  const distanceFromCurrent = Math.abs(option.strike - currentPrice);
  const distanceScore = Math.max(0, 100 - (distanceFromCurrent / 1000) * 10);

  // デルタスコア - 0.3-0.6の範囲が高評価
  const delta = option.delta; // 型チェックが完了していて安全
  const deltaScore = option.type === 'call' ?
    (delta >= 0.3 && delta <= 0.6 ? 100 : 50 * (1 - Math.abs(delta - 0.45) / 0.45)) :
    (Math.abs(delta) >= 0.3 && Math.abs(delta) <= 0.6 ? 100 : 50 * (1 - Math.abs(Math.abs(delta) - 0.45) / 0.45));

  // 理論価格との乗離 (mockなので簡易計算)
  const fairPremium = delta * distanceFromCurrent * 0.1;
  const premiumScore = fairPremium === 0 ? 50 : 
    Math.max(0, 100 - Math.abs(option.markPrice - fairPremium) / fairPremium * 100);

  // 流動性スコア
  const volumeScore = Math.min(100, option.volume / 10);

  // 総合スコア (加重平均)
  const totalScore = (
    distanceScore * 0.2 +
    deltaScore * 0.3 +
    premiumScore * 0.4 +
    volumeScore * 0.1
  );

  return Math.round(totalScore);
};

// プレミアム異常値計算 (-100: 極端に割安, 0: 適正, 100: 極端に割高)
const calculatePremiumAnomaly = (option: Partial<OptionData>, fairPremium: number): number => {
  // 必要なプロパティが存在するか確認
  if (option.markPrice === undefined) {
    return 0; // データ不足の場合は中間値を返す
  }
  
  // 簡易計算: プレミアムが理論値からどれだけ乖離しているか
  if (fairPremium === 0) return 0;
  const anomaly = ((option.markPrice - fairPremium) / fairPremium) * 100;
  return Math.max(-100, Math.min(100, anomaly));
};

// 理論的なプレミアム（公正価格）を計算するヘルパー関数
const calculateFairPremium = (option: Partial<OptionData>, currentPrice: number): number => {
  // 必要なプロパティが存在するか確認
  if (option.strike === undefined || option.delta === undefined) {
    return 0; // データ不足の場合はゼロを返す
  }
  
  const distanceFromCurrent = Math.abs(option.strike - currentPrice);
  // デルタを使って理論価格を簡易計算（実際の市場ではより複雑なモデルを使用）
  return Math.abs(option.delta) * distanceFromCurrent * 0.1;
};



// アラートフラグの計算
const calculateAlerts = (option: Partial<OptionData>, currentPrice: number, fairPremium: number) => {
  // 必要なプロパティが存在するか確認
  if (option.strike === undefined || option.delta === undefined || 
      option.markPrice === undefined) {
    return {}; // データ不足の場合は空のオブジェクトを返す
  }
  
  const absDistanceFromCurrent = Math.abs(option.strike - currentPrice);
  const absDelta = Math.abs(option.delta);

  return {
    isInDecisionZone: absDelta >= 0.3 && absDelta <= 0.6,
    isUnderpriced: option.markPrice < fairPremium * 0.7,  // 30%以上安い
    isOverpriced: option.markPrice > fairPremium * 1.3,   // 30%以上高い
    hasVolumeSpike: option.volumeChange !== undefined ? option.volumeChange > 25 : false,
    hasOiSpike: option.oiChange !== undefined ? option.oiChange > 15 : false,
    hasImbalance: (absDelta > 0.5 && option.markPrice < fairPremium * 0.8) || 
                  (absDelta < 0.2 && option.markPrice > fairPremium * 1.2)
  };
};

// コールオプションのモックデータ（複数の満期日に対応）
const rawCallOptions = [
  // 2025-05-02の満期日データ
  { strike: 70000, markPrice: 24000, iv: 63, delta: 0.97, gamma: 0.0005, volume: 210, openInterest: 650, type: 'call' as const, expiry: '2025-05-02', volumeChange: 10, oiChange: 4 },
  { strike: 80000, markPrice: 14800, iv: 57, delta: 0.86, gamma: 0.0014, volume: 460, openInterest: 1200, type: 'call' as const, expiry: '2025-05-02', volumeChange: 22, oiChange: 13 },
  { strike: 90000, markPrice: 7500, iv: 53, delta: 0.65, gamma: 0.0033, volume: 620, openInterest: 1600, type: 'call' as const, expiry: '2025-05-02', volumeChange: 32, oiChange: 18 },
  { strike: 95000, markPrice: 4600, iv: 50, delta: 0.45, gamma: 0.0042, volume: 590, openInterest: 1500, type: 'call' as const, expiry: '2025-05-02', volumeChange: 50, oiChange: 22 },
  { strike: 100000, markPrice: 2400, iv: 48, delta: 0.30, gamma: 0.0045, volume: 500, openInterest: 1300, type: 'call' as const, expiry: '2025-05-02', volumeChange: 28, oiChange: 16 },
  { strike: 110000, markPrice: 850, iv: 46, delta: 0.16, gamma: 0.0033, volume: 360, openInterest: 920, type: 'call' as const, expiry: '2025-05-02', volumeChange: 13, oiChange: 6 },

  // 2025-05-31の満期日データ
  { strike: 70000, markPrice: 24200, iv: 64, delta: 0.97, gamma: 0.0005, volume: 220, openInterest: 660, type: 'call' as const, expiry: '2025-05-31', volumeChange: 11, oiChange: 4 },
  { strike: 80000, markPrice: 15000, iv: 57, delta: 0.87, gamma: 0.0014, volume: 470, openInterest: 1220, type: 'call' as const, expiry: '2025-05-31', volumeChange: 23, oiChange: 14 },
  { strike: 90000, markPrice: 7600, iv: 53, delta: 0.66, gamma: 0.0034, volume: 630, openInterest: 1630, type: 'call' as const, expiry: '2025-05-31', volumeChange: 33, oiChange: 19 },
  { strike: 95000, markPrice: 4700, iv: 50, delta: 0.46, gamma: 0.0043, volume: 600, openInterest: 1520, type: 'call' as const, expiry: '2025-05-31', volumeChange: 52, oiChange: 23 },
  { strike: 100000, markPrice: 2500, iv: 48, delta: 0.31, gamma: 0.0046, volume: 510, openInterest: 1310, type: 'call' as const, expiry: '2025-05-31', volumeChange: 29, oiChange: 17 },
  { strike: 110000, markPrice: 900, iv: 46, delta: 0.17, gamma: 0.0034, volume: 370, openInterest: 930, type: 'call' as const, expiry: '2025-05-31', volumeChange: 14, oiChange: 6 },

  // 2025-06-28の満期日データ（既存）
  { strike: 70000, markPrice: 24500, iv: 65, delta: 0.98, gamma: 0.0005, volume: 230, openInterest: 680, type: 'call' as const, expiry: '2025-06-28', volumeChange: 12, oiChange: 5 },
  { strike: 75000, markPrice: 19800, iv: 62, delta: 0.94, gamma: 0.001, volume: 350, openInterest: 920, type: 'call' as const, expiry: '2025-06-28', volumeChange: 18, oiChange: 10 },
  { strike: 80000, markPrice: 15200, iv: 58, delta: 0.88, gamma: 0.0015, volume: 480, openInterest: 1250, type: 'call' as const, expiry: '2025-06-28', volumeChange: 25, oiChange: 15 },
  { strike: 85000, markPrice: 11100, iv: 55, delta: 0.80, gamma: 0.002, volume: 520, openInterest: 1350, type: 'call' as const, expiry: '2025-06-28', volumeChange: 20, oiChange: 8 },
  { strike: 90000, markPrice: 7800, iv: 54, delta: 0.68, gamma: 0.0035, volume: 650, openInterest: 1680, type: 'call' as const, expiry: '2025-06-28', volumeChange: 35, oiChange: 20 },
  { strike: 92500, markPrice: 6200, iv: 52, delta: 0.58, gamma: 0.004, volume: 580, openInterest: 1480, type: 'call' as const, expiry: '2025-06-28', volumeChange: 30, oiChange: 18 },
  { strike: 95000, markPrice: 4900, iv: 51, delta: 0.48, gamma: 0.0045, volume: 610, openInterest: 1550, type: 'call' as const, expiry: '2025-06-28', volumeChange: 55, oiChange: 25 },
  { strike: 97500, markPrice: 3700, iv: 50, delta: 0.40, gamma: 0.0048, volume: 560, openInterest: 1420, type: 'call' as const, expiry: '2025-06-28', volumeChange: 25, oiChange: 12 },
  { strike: 100000, markPrice: 2650, iv: 49, delta: 0.32, gamma: 0.0047, volume: 520, openInterest: 1320, type: 'call' as const, expiry: '2025-06-28', volumeChange: 30, oiChange: 18 },
  // ここに異常値を持つオプションを追加 (デルタは低いが価格が著しく低いケース)
  { strike: 105000, markPrice: 1200, iv: 48, delta: 0.22, gamma: 0.004, volume: 470, openInterest: 1220, type: 'call' as const, expiry: '2025-06-28', volumeChange: 80, oiChange: 40 },
  { strike: 110000, markPrice: 950, iv: 47, delta: 0.18, gamma: 0.0035, volume: 380, openInterest: 950, type: 'call' as const, expiry: '2025-06-28', volumeChange: 15, oiChange: 7 },
  { strike: 115000, markPrice: 650, iv: 46, delta: 0.12, gamma: 0.003, volume: 290, openInterest: 720, type: 'call' as const, expiry: '2025-06-28', volumeChange: 10, oiChange: 5 },
  { strike: 120000, markPrice: 420, iv: 45, delta: 0.08, gamma: 0.0025, volume: 210, openInterest: 540, type: 'call' as const, expiry: '2025-06-28', volumeChange: 8, oiChange: 3 },
];

// -------- old callOptions/putOptions 定義は削除し、後段で完全版をエクスポート --------
// プットオプションのモックデータ（複数の満期日に対応）
const rawPutOptions = [
  // 2025-05-02の満期日データ
  { strike: 70000, markPrice: 900, iv: 54, delta: -0.05, gamma: 0.0015, volume: 180, openInterest: 480, type: 'put' as const, expiry: '2025-05-02', volumeChange: 8, oiChange: 3 },
  { strike: 80000, markPrice: 1700, iv: 55, delta: -0.15, gamma: 0.0025, volume: 280, openInterest: 720, type: 'put' as const, expiry: '2025-05-02', volumeChange: 15, oiChange: 7 },
  { strike: 90000, markPrice: 4100, iv: 57, delta: -0.35, gamma: 0.0035, volume: 420, openInterest: 1100, type: 'put' as const, expiry: '2025-05-02', volumeChange: 25, oiChange: 12 },
  { strike: 95000, markPrice: 6000, iv: 58, delta: -0.52, gamma: 0.0042, volume: 530, openInterest: 1350, type: 'put' as const, expiry: '2025-05-02', volumeChange: 32, oiChange: 15 },
  { strike: 100000, markPrice: 8500, iv: 59, delta: -0.68, gamma: 0.0038, volume: 490, openInterest: 1250, type: 'put' as const, expiry: '2025-05-02', volumeChange: 28, oiChange: 14 },
  { strike: 110000, markPrice: 15500, iv: 62, delta: -0.87, gamma: 0.0025, volume: 320, openInterest: 850, type: 'put' as const, expiry: '2025-05-02', volumeChange: 18, oiChange: 9 },

  // 2025-05-31の満期日データ
  { strike: 70000, markPrice: 920, iv: 54, delta: -0.05, gamma: 0.0015, volume: 190, openInterest: 490, type: 'put' as const, expiry: '2025-05-31', volumeChange: 8, oiChange: 3 },
  { strike: 80000, markPrice: 1750, iv: 55, delta: -0.16, gamma: 0.0026, volume: 290, openInterest: 730, type: 'put' as const, expiry: '2025-05-31', volumeChange: 16, oiChange: 7 },
  { strike: 90000, markPrice: 4200, iv: 57, delta: -0.36, gamma: 0.0036, volume: 430, openInterest: 1120, type: 'put' as const, expiry: '2025-05-31', volumeChange: 26, oiChange: 13 },
  { strike: 95000, markPrice: 6100, iv: 58, delta: -0.53, gamma: 0.0043, volume: 540, openInterest: 1360, type: 'put' as const, expiry: '2025-05-31', volumeChange: 33, oiChange: 16 },
  { strike: 100000, markPrice: 8600, iv: 59, delta: -0.69, gamma: 0.0039, volume: 500, openInterest: 1270, type: 'put' as const, expiry: '2025-05-31', volumeChange: 29, oiChange: 14 },
  { strike: 110000, markPrice: 15600, iv: 62, delta: -0.88, gamma: 0.0026, volume: 330, openInterest: 860, type: 'put' as const, expiry: '2025-05-31', volumeChange: 19, oiChange: 9 },

  // 2025-06-28の満期日データ（既存）
  { strike: 70000, markPrice: 950, iv: 65, delta: -0.02, gamma: 0.0005, volume: 180, openInterest: 450, type: 'put' as const, expiry: '2025-06-28', volumeChange: 15, oiChange: 8 },
  { strike: 75000, markPrice: 1350, iv: 62, delta: -0.06, gamma: 0.001, volume: 220, openInterest: 580, type: 'put' as const, expiry: '2025-06-28', volumeChange: 20, oiChange: 12 },
  { strike: 80000, markPrice: 2150, iv: 58, delta: -0.12, gamma: 0.002, volume: 320, openInterest: 840, type: 'put' as const, expiry: '2025-06-28', volumeChange: 30, oiChange: 18 },
  { strike: 85000, markPrice: 3500, iv: 55, delta: -0.20, gamma: 0.0025, volume: 380, openInterest: 980, type: 'put' as const, expiry: '2025-06-28', volumeChange: 25, oiChange: 15 },
  { strike: 90000, markPrice: 5200, iv: 54, delta: -0.32, gamma: 0.003, volume: 450, openInterest: 1150, type: 'put' as const, expiry: '2025-06-28', volumeChange: 35, oiChange: 20 },
  // プットの「買い目」設定: デルタ高めなのにプレミアムが割安
  { strike: 92500, markPrice: 3900, iv: 52, delta: -0.42, gamma: 0.0035, volume: 510, openInterest: 1280, type: 'put' as const, expiry: '2025-06-28', volumeChange: 65, oiChange: 32 },
  { strike: 95000, markPrice: 6100, iv: 51, delta: -0.52, gamma: 0.004, volume: 480, openInterest: 1180, type: 'put' as const, expiry: '2025-06-28', volumeChange: 28, oiChange: 16 },
  { strike: 97500, markPrice: 7800, iv: 50, delta: -0.62, gamma: 0.0045, volume: 520, openInterest: 1350, type: 'put' as const, expiry: '2025-06-28', volumeChange: 35, oiChange: 20 },
  { strike: 100000, markPrice: 9700, iv: 48, delta: -0.72, gamma: 0.004, volume: 420, openInterest: 1080, type: 'put' as const, expiry: '2025-06-28', volumeChange: 22, oiChange: 14 },
  { strike: 105000, markPrice: 13500, iv: 47, delta: -0.82, gamma: 0.0035, volume: 340, openInterest: 880, type: 'put' as const, expiry: '2025-06-28', volumeChange: 18, oiChange: 10 },
  { strike: 110000, markPrice: 17800, iv: 46, delta: -0.88, gamma: 0.003, volume: 260, openInterest: 680, type: 'put' as const, expiry: '2025-06-28', volumeChange: 12, oiChange: 7 },
  { strike: 115000, markPrice: 22100, iv: 45, delta: -0.92, gamma: 0.002, volume: 190, openInterest: 480, type: 'put' as const, expiry: '2025-06-28', volumeChange: 10, oiChange: 5 },
  { strike: 120000, markPrice: 26300, iv: 44, delta: -0.95, gamma: 0.0015, volume: 140, openInterest: 360, type: 'put' as const, expiry: '2025-06-28', volumeChange: 8, oiChange: 3 },
];

// 満期日リスト: UI正準の満期日リスト
import { availableExpiryDates } from './bybitOptionData';
export const expirations = availableExpiryDates;

// Filter presets
export const filterPresets = [
  { id: 'all', name: 'Show All' },
  { id: 'safeIncome', name: 'Safe Income Strategy', criteria: { minDelta: 0.1, maxDelta: 0.3 } },
  { id: 'highRisk', name: 'High Risk/High Return', criteria: { minDelta: 0.4, minIv: 60 } },
  { id: 'lowIv', name: 'Low IV Opportunity', criteria: { maxIv: 50 } },
];

// 07-26, 09-27など他の満期日のデータも自動生成
function generateMoreExpiryData() {
  const moreExpirations = ["2025-07-26", "2025-09-27", "2025-12-27", "2026-03-27", "2026-06-26"];
  const baseCallOptions = rawCallOptions.filter(option => option.expiry === "2025-06-28");
  const basePutOptions = rawPutOptions.filter(option => option.expiry === "2025-06-28");

  let generatedCalls: any[] = [];
  let generatedPuts: any[] = [];

  moreExpirations.forEach(expiry => {
    // IV調整値（満期が長いほどIVは低くなる傾向）
    const ivAdjust = expiry.startsWith("2026") ? -2 : 0;

    // コールオプションを生成
    baseCallOptions.forEach(baseOption => {
      const newOption = { ...baseOption, expiry, iv: Math.max(40, baseOption.iv + ivAdjust) };
      generatedCalls.push(newOption);
    });

    // プットオプションを生成
    basePutOptions.forEach(baseOption => {
      const newOption = { ...baseOption, expiry, iv: Math.max(40, baseOption.iv + ivAdjust) };
      generatedPuts.push(newOption);
    });
  });

  // 生成したデータを元の配列に結合
  rawCallOptions.push(...generatedCalls);
  rawPutOptions.push(...generatedPuts);
}

// 追加データを生成
generateMoreExpiryData();

// ----------------- Bybit 実データを取り込み -----------------
// スクリプト生成ファイルを一括 import し、realCallOptions_xxx / realPutOptions_xxx を追加
import * as bybitData from './bybitOptionData';

Object.entries(bybitData).forEach(([key, value]) => {
  if (Array.isArray(value)) {
    if (key.startsWith('realCallOptions_')) {
      rawCallOptions.push(...(value as any[]));
    } else if (key.startsWith('realPutOptions_')) {
      rawPutOptions.push(...(value as any[]));
    }
  }
});

// ----------------- オプションデータを加工 -----------------
export const callOptions: OptionData[] = rawCallOptions.map((option) => {
  const baseOption = option as Partial<OptionData>;
  const buyScore = calculateBuyScore(baseOption, currentPrice);
  const fairPremium = calculateFairPremium(baseOption, currentPrice);
  const premiumAnomaly = calculatePremiumAnomaly(baseOption, fairPremium);
  const spread = option.markPrice * 0.05;
  const bid = option.markPrice - spread / 2;
  const ask = option.markPrice + spread / 2;
  const theta = -Math.abs(option.iv) * 0.001; // 簡易 θ
  return {
    ...option,
    bid,
    ask,
    theta,
    buyScore,
    fairPremium,
    premiumAnomaly,
    alerts: calculateAlerts({ ...baseOption, buyScore, fairPremium }, currentPrice, fairPremium),
  } as OptionData;
});

export const putOptions: OptionData[] = rawPutOptions.map((option) => {
  const baseOption = option as Partial<OptionData>;
  const buyScore = calculateBuyScore(baseOption, currentPrice);
  const fairPremium = calculateFairPremium(baseOption, currentPrice);
  const premiumAnomaly = calculatePremiumAnomaly(baseOption, fairPremium);
  const spread = option.markPrice * 0.05;
  const bid = option.markPrice - spread / 2;
  const ask = option.markPrice + spread / 2;
  const theta = -Math.abs(option.iv) * 0.001;
  return {
    ...option,
    bid,
    ask,
    theta,
    buyScore,
    fairPremium,
    premiumAnomaly,
    alerts: calculateAlerts({ ...baseOption, buyScore, fairPremium }, currentPrice, fairPremium),
  } as OptionData;
});
