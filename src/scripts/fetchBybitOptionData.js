import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --------- CLI Args ---------
// Usage: node fetchBybitOptionData.js 2025-05-02,2025-05-30
const args = process.argv.slice(2);
const requestedDates = args[0] ? args[0].split(',') : [];

// If no dates supplied, fall back to UI 側の満期リスト
const DEFAULT_DATES = [
  '2025-05-02',
  '2025-05-31', // UI は土曜、API は前日の金曜に合わせる
  '2025-06-28',
  '2025-07-26',
  '2025-09-27',
  '2025-12-27',
  '2026-03-27',
  '2026-06-26',
];

const TARGET_DATES = requestedDates.length ? requestedDates : DEFAULT_DATES;

const BYBIT_API_BASE_URL = 'https://api.bybit.com';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ---- Helpers reused from legacy script ----
function parseSymbol(symbol) {
  try {
    const parts = symbol.split('-');
    if (parts.length !== 5) return null;
    const dateStr = parts[1]; // 02MAY25
    const strikeStr = parts[2];
    const optionType = parts[3];

    const strike = parseInt(strikeStr, 10);
    const type = optionType === 'C' ? 'call' : 'put';

    const months = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    };

    let day = dateStr.match(/^\d+/)[0];
    if (day.length === 1) day = '0' + day;

    const month = months[dateStr.match(/[A-Z]+/)[0]];
    const year = '20' + dateStr.match(/\d+$/)[0];

    const expiryDate = `${year}-${month}-${day}`;
    return { symbol, strike, type, expiryDate };
  } catch {
    return null;
  }
}

async function getCurrentBTCPrice() {
  const res = await axios.get(`${BYBIT_API_BASE_URL}/v5/market/tickers`, {
    params: { category: 'spot', symbol: 'BTCUSDT' },
  });
  if (res.data.retCode === 0 && res.data.result.list.length) {
    return parseFloat(res.data.result.list[0].lastPrice);
  }
  throw new Error('Failed price fetch');
}

async function fetchRawData(targetDate, currentPrice, tickers, instruments) {
  const callOptions = [];
  const putOptions = [];

  const getStrikeFromSymbol = (symbol) => {
    const m = symbol.match(/BTC-\d+[A-Z]+\d+-(\d+)-[CP]-USDT/);
    return m ? parseInt(m[1], 10) : null;
  };

  for (const ticker of tickers) {
    const parsed = parseSymbol(ticker.symbol);
    if (!parsed) continue;

    if (!parsed.expiryDate.startsWith(targetDate)) continue;

    if (!parsed.strike) {
      parsed.strike = getStrikeFromSymbol(ticker.symbol);
      if (!parsed.strike) continue;
    }

    const markPrice = parseFloat(ticker.markPrice || '0');
    if (!markPrice) continue;

    // Delta handling (simple fallback)
    let delta = ticker.delta ? parseFloat(ticker.delta) : null;
    if (delta == null || Number.isNaN(delta)) {
      const norm = Math.abs(parsed.strike - currentPrice) / currentPrice;
      delta = parsed.type === 'call' ? 0.5 - norm : -0.5 + norm;
    }

    let iv = parseFloat(ticker.iv || '0.5');
    if (iv < 1) iv *= 100;

    const volume = parseFloat(ticker.volume24h || '0') || 100;
    const openInterest = parseFloat(ticker.openInterest || '0') || 200;

    const option = {
      strike: parsed.strike,
      markPrice,
      iv,
      delta,
      gamma: 0.001,
      volume,
      openInterest,
      type: parsed.type,
      expiry: targetDate,
      volumeChange: Math.round(Math.random() * 30),
      oiChange: Math.round(Math.random() * 20),
    };

    if (parsed.type === 'call') callOptions.push(option);
    else putOptions.push(option);
  }

  return { callOptions, putOptions };
}

// Instruments list を一度取得して共通利用
let cachedInstrumentsPromise;
async function getInstruments() {
  if (!cachedInstrumentsPromise) {
    cachedInstrumentsPromise = axios
      .get(`${BYBIT_API_BASE_URL}/v5/market/instruments-info`, {
        params: { category: 'option', baseCoin: 'BTC' },
      })
      .then((r) => r.data.result.list);
  }
  return cachedInstrumentsPromise;
}

function toDateObj(str) {
  return new Date(str + 'T00:00:00Z');
}

// UI の日付から最も近い Bybit Expiry を探す (±1日以内)
async function mapUiDateToApiDate(uiDate) {
  const instruments = await getInstruments();
  const expiries = Array.from(
    new Set(
      instruments
        .map((i) => {
          const p = parseSymbol(i.symbol);
          return p ? p.expiryDate : null;
        })
        .filter(Boolean),
    ),
  );
  const target = toDateObj(uiDate);
  let closest = null;
  let minDiff = Infinity;
  for (const e of expiries) {
    const diff = Math.abs(toDateObj(e) - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = e;
    }
  }
  return closest || uiDate;
}

async function getOptionsForDate(uiDate) {
  const apiDate = await mapUiDateToApiDate(uiDate);
  const currentPrice = await getCurrentBTCPrice();
  const tickersResp = await axios.get(`${BYBIT_API_BASE_URL}/v5/market/tickers`, {
    params: { category: 'option', baseCoin: 'BTC' },
  });
  const tickers = tickersResp.data.result.list;
  const instruments = await getInstruments();

  const { callOptions, putOptions } = await fetchRawData(apiDate, currentPrice, tickers, instruments);
  return { callOptions, putOptions, apiDate, currentPrice };
}

async function main() {
  const currentPrice = await getCurrentBTCPrice(); // just once
  const exports = [];
  const exportedDates = new Set();

  for (const uiDate of TARGET_DATES) {
    console.log(`Fetching ${uiDate} ...`);
    try {
      const { callOptions, putOptions, apiDate } = await getOptionsForDate(uiDate);
      if (exportedDates.has(apiDate)) {
        console.log(`Duplicate apiDate ${apiDate} mapped from ${uiDate}, skipping.`);
        continue;
      }
      exportedDates.add(apiDate);
      const dateKey = apiDate.replace(/-/g, '_');
      exports.push(
        `export const realCallOptions_${dateKey} = ${JSON.stringify(callOptions, null, 2)};`,
      );
      exports.push(
        `export const realPutOptions_${dateKey}  = ${JSON.stringify(putOptions, null, 2)};`,
      );
    } catch (e) {
      console.error('Failed', uiDate, e.message);
    }
    await sleep(1500); // avoid rate limit
  }

  const output = `// Auto-generated ${new Date().toISOString()}
${exports.join('\n\n')}

export const availableExpiryDates = ${JSON.stringify(Array.from(exportedDates))};
export const currentBTCPrice = ${currentPrice};
`;
  const outPath = path.resolve(__dirname, '../mockData/bybitOptionData.js');
  fs.writeFileSync(outPath, output);
  console.log('Saved to', outPath);
}

main();
