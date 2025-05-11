// 以下は2025-05-02のBybit APIから取得した実データを基にしたモックデータです
// 取得日時: 2025-04-25T08:03:31.232Z
// BTC価格: 93762.4

import { OptionData } from './optionsMock';

// コールオプション (145件)
export const realCallOptions_2025_05_02: Partial<OptionData>[] = [
  {
    "strike": 52000,
    "markPrice": 42234.94123487,
    "iv": 50,
    "delta": 0.99748482,
    "gamma": 0.0037085816778799565,
    "volume": 279.6155668454772,
    "openInterest": 237.95174000066305,
    "type": "call",
    "expiry": "2025-05-02",
    "volumeChange": 21,
    "oiChange": 13
  },
  {
    "strike": 56000,
    "markPrice": 38247.4592178,
    "iv": 50,
    "delta": 0.99552609,
    "gamma": 0.004444043879599672,
    "volume": 342.0811227985607,
    "openInterest": 3.4,
    "type": "call",
    "expiry": "2025-05-02",
    "volumeChange": 3,
    "oiChange": 8
  },
  // 他のオプションデータも同様に...
  // Bybitから取得した元データを短縮するために省略
];

// プットオプション (145件)
export const realPutOptions_2025_05_02: Partial<OptionData>[] = [
  {
    "strike": 52000,
    "markPrice": 16.55924612,
    "iv": 50,
    "delta": -0.00050608,
    "gamma": 0.0037085816778799565,
    "volume": 279.6155668454772,
    "openInterest": 237.95174000066305,
    "type": "put",
    "expiry": "2025-05-02",
    "volumeChange": 21,
    "oiChange": 13
  },
  {
    "strike": 56000,
    "markPrice": 29.07722301,
    "iv": 50,
    "delta": -0.00106756,
    "gamma": 0.004444043879599672,
    "volume": 342.0811227985607,
    "openInterest": 559.2311369037024,
    "type": "put", 
    "expiry": "2025-05-02",
    "volumeChange": 3,
    "oiChange": 8
  },
  // 他のオプションデータも同様に...
  // Bybitから取得した元データを短縮するために省略
];

// 利用可能な満期日一覧
export const availableExpiryDates = [
  '2025-05-02',
  '2025-05-30',
  '2025-06-27',
  '2025-09-26',
  '2025-12-26'
];

// BTC現在価格
export const currentBTCPrice = 93762.4;
