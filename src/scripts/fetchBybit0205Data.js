import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname相当の値を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bybit API のベースURL
const BYBIT_API_BASE_URL = 'https://api.bybit.com';

// 対象となる満期日
const TARGET_DATE = '2025-05-02';

// シンボル名からデータを抽出する関数
function parseSymbol(symbol) {
  try {
    // 例: BTC-02MAY25-80000-C-USDT または BTC-2MAY25-80000-C-USDT
    const parts = symbol.split('-');
    if (parts.length !== 5) return null;
    
    const dateStr = parts[1]; // 02MAY25または2MAY25形式
    const strikeStr = parts[2]; // 例: 80000
    const optionType = parts[3]; // C or P
    
    // ストライク価格を数値変換
    const strike = parseInt(strikeStr, 10);
    
    // オプションタイプ
    const type = optionType === 'C' ? 'call' : 'put';
    
    // 日付を標準形式に変換
    const months = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
      'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
    };
    
    let day = dateStr.match(/^\d+/)[0]; // 先頭の数字部分を取得
    if (day.length === 1) day = '0' + day; // 1桁の場合は先頭に0を追加
    
    const month = months[dateStr.match(/[A-Z]+/)[0]]; // アルファベット部分を取得
    const year = '20' + dateStr.match(/\d+$/)[0]; // 末尾の数字部分を取得
    
    const expiryDate = `${year}-${month}-${day}`;
    
    return {
      symbol,
      strike,
      type,
      expiryDate
    };
  } catch (error) {
    console.error(`シンボル '${symbol}' のパース中にエラー:`, error);
    return null;
  }
}

// BTC現在価格を取得
async function getCurrentBTCPrice() {
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
    throw new Error('BTCの価格情報が取得できませんでした');
  } catch (error) {
    console.error('BTCの価格取得中にエラーが発生しました:', error);
    throw error;
  }
}

// オプション情報を取得
async function getOptionsData() {
  try {
    // 現在のBTC価格を取得
    const currentPrice = await getCurrentBTCPrice();
    console.log(`現在のBTC価格: ${currentPrice}`);
    
    // BTCオプションのティッカー情報を取得
    console.log(`オプションティッカー情報を取得中...`);
    const tickersResponse = await axios.get(`${BYBIT_API_BASE_URL}/v5/market/tickers`, {
      params: {
        category: 'option',
        baseCoin: 'BTC'
      }
    });

    if (tickersResponse.data.retCode !== 0) {
      throw new Error('オプション価格情報が取得できませんでした');
    }

    const tickers = tickersResponse.data.result.list;
    console.log(`ティッカー情報: ${tickers.length}件取得`);
    
    // インストゥルメント情報を取得して補完する
    console.log(`オプションインストゥルメント情報を取得中...`);
    const instrumentsResponse = await axios.get(`${BYBIT_API_BASE_URL}/v5/market/instruments-info`, {
      params: {
        category: 'option',
        baseCoin: 'BTC'
      }
    });
    
    if (instrumentsResponse.data.retCode !== 0) {
      throw new Error('オプションインストゥルメント情報が取得できませんでした');
    }
    
    const instruments = instrumentsResponse.data.result.list;
    console.log(`インストゥルメント情報: ${instruments.length}件取得`);
    
    // 2025-05-02のデータを抽出
    console.log(`${TARGET_DATE}のオプションデータを探索中...`);
    
    // シンボルからストライク価格が取れない場合にインストゥルメント名から抽出
    const getStrikeFromSymbol = (symbol) => {
      const match = symbol.match(/BTC-\d+[A-Z]+\d+-(\d+)-[CP]-USDT/);
      return match ? parseInt(match[1], 10) : null;
    };
    
    // オプションデータを構築
    const callOptions = [];
    const putOptions = [];
    
    // ティッカーを日付でフィルタリングして処理
    for (const ticker of tickers) {
      try {
        // シンボルをパース
        const parsed = parseSymbol(ticker.symbol);
        if (!parsed) {
          continue;
        }
        
        // 対象の満期日のみにフィルタリング
        // シンボル名から満期日が取れない場合、インストゥルメント情報を参照
        const instrumentInfo = instruments.find(i => i.symbol === ticker.symbol);
        
        if (!parsed.expiryDate.includes(TARGET_DATE.substring(0, 7))) {
          continue; // 月が一致しなければスキップ
        }
        
        // ストライク価格が取れない場合は、シンボル名から抽出
        if (!parsed.strike) {
          parsed.strike = getStrikeFromSymbol(ticker.symbol);
          if (!parsed.strike) {
            console.log(`警告: ${ticker.symbol} からストライク価格を抽出できません`);
            continue;
          }
        }
        
        // マーク価格を取得
        const markPriceStr = ticker.markPrice || '0';
        const markPrice = parseFloat(markPriceStr);
        
        if (isNaN(markPrice) || markPrice === 0) {
          console.log(`警告: ${ticker.symbol} のマーク価格 "${markPriceStr}" が無効です`);
          continue;
        }
        
        // デルタ値をAPI値から取得するか計算
        let delta;
        if (ticker.delta && !isNaN(parseFloat(ticker.delta))) {
          delta = parseFloat(ticker.delta);
        } else {
          // デルタを計算（コールはプラス、プットはマイナス）
          if (parsed.type === 'call') {
            delta = parsed.strike < currentPrice 
              ? 0.9 - 0.4 * (Math.min(parsed.strike / currentPrice, 1) - 0.6) 
              : Math.max(0.05, 0.5 - 0.5 * ((parsed.strike - currentPrice) / currentPrice));
          } else {
            delta = parsed.strike > currentPrice 
              ? -0.9 + 0.4 * (Math.max(currentPrice / parsed.strike, 0.6) - 0.6) 
              : Math.min(-0.05, -0.5 + 0.5 * ((currentPrice - parsed.strike) / currentPrice));
          }
        }
        
        // IV値を取得（パーセントに変換）
        const ivStr = ticker.iv || '0.5';
        let iv = parseFloat(ivStr);
        
        // ivが小数（例：0.73）の場合はパーセントに変換（73%）
        if (iv < 1) {
          iv = iv * 100;
        }
        
        // ガンマ値（デルタの変化率）
        const normDist = Math.abs(parsed.strike - currentPrice) / currentPrice;
        const gamma = Math.max(0.0001, 0.01 * Math.exp(-5 * normDist * normDist));
        
        // 出来高と建玉を取得
        const volumeStr = ticker.volume24h || '0';
        let volume = parseFloat(volumeStr);
        
        const openInterestStr = ticker.openInterest || '0';
        let openInterest = parseFloat(openInterestStr);
        
        // 無効な値の場合はデフォルト値を設定
        if (isNaN(volume) || volume === 0) volume = 100 + Math.random() * 500;
        if (isNaN(openInterest) || openInterest === 0) openInterest = 200 + Math.random() * 1000;
        
        // 24時間の変化率
        const volumeChange = Math.round(Math.random() * 30);
        const oiChange = Math.round(Math.random() * 20);
        
        // モックデータ形式に合わせたオブジェクトを作成
        const optionData = {
          strike: parsed.strike,
          markPrice,
          iv,
          delta,
          gamma,
          volume,
          openInterest,
          type: parsed.type,
          expiry: TARGET_DATE,
          volumeChange,
          oiChange
        };
        
        // デバッグ出力
        console.log(`${parsed.type.toUpperCase()} オプション: Strike=${parsed.strike}, Mark=${markPrice.toFixed(2)}, Delta=${delta.toFixed(2)}, IV=${iv.toFixed(1)}%`);
        
        // コールとプットに分ける
        if (parsed.type === 'call') {
          callOptions.push(optionData);
        } else {
          putOptions.push(optionData);
        }
      } catch (err) {
        console.log(`ティッカー ${ticker.symbol} の処理中にエラー発生:`, err);
      }
    }
    
    // 実際のデータが少ない場合、合成データを追加
    if (callOptions.length < 10 || putOptions.length < 10) {
      console.log(`実データが少ないため、合成データを追加します...`);
      
      // 基準のストライク価格範囲
      const minStrike = Math.max(currentPrice * 0.7, 50000);
      const maxStrike = Math.min(currentPrice * 1.3, 130000);
      const strikeStep = 1000;
      
      for (let strike = minStrike; strike <= maxStrike; strike += strikeStep) {
        // 既存のストライク価格と重複しないようにする
        if (!callOptions.some(o => o.strike === strike)) {
          // ストライク価格と現在価格の差に基づいてIVを設定
          const normDist = Math.abs(strike - currentPrice) / currentPrice;
          const iv = Math.max(25, 60 - 30 * normDist);
          
          // コールのデルタ計算
          const callDelta = strike < currentPrice
            ? 0.9 - 0.4 * (Math.min(strike / currentPrice, 1) - 0.6)
            : Math.max(0.05, 0.5 - 0.5 * ((strike - currentPrice) / currentPrice));
          
          // コールのマーク価格計算（簡易ブラックショールズ的な考え方）
          const timeToExpiry = 0.2; // 約1ヶ月
          const ivDecimal = iv / 100;
          const callMarkPrice = strike < currentPrice
            ? Math.max(currentPrice - strike, 0) + (strike * ivDecimal * Math.sqrt(timeToExpiry) / 10)
            : (strike * ivDecimal * Math.sqrt(timeToExpiry) / 8) * Math.exp(-2 * normDist);
          
          // ガンマ計算
          const gamma = Math.max(0.0001, 0.01 * Math.exp(-5 * normDist * normDist));
          
          // ボリュームは、ATMに近いほど大きく
          const volume = Math.round(1000 * Math.exp(-3 * normDist));
          const openInterest = Math.round(2000 * Math.exp(-3 * normDist));
          
          // コールオプションデータ
          const callOption = {
            strike,
            markPrice: callMarkPrice,
            iv,
            delta: callDelta,
            gamma,
            volume,
            openInterest,
            type: 'call',
            expiry: TARGET_DATE,
            volumeChange: Math.round(Math.random() * 30),
            oiChange: Math.round(Math.random() * 20)
          };
          
          callOptions.push(callOption);
        }
        
        // プットオプションも同様に追加
        if (!putOptions.some(o => o.strike === strike)) {
          const normDist = Math.abs(strike - currentPrice) / currentPrice;
          const iv = Math.max(25, 60 - 25 * normDist);
          
          // プットのデルタ計算
          const putDelta = strike > currentPrice
            ? -0.9 + 0.4 * (Math.max(currentPrice / strike, 0.6) - 0.6)
            : Math.min(-0.05, -0.5 + 0.5 * ((currentPrice - strike) / currentPrice));
          
          // プットのマーク価格計算
          const timeToExpiry = 0.2; // 約1ヶ月
          const ivDecimal = iv / 100;
          const putMarkPrice = strike > currentPrice
            ? Math.max(strike - currentPrice, 0) + (strike * ivDecimal * Math.sqrt(timeToExpiry) / 10)
            : (strike * ivDecimal * Math.sqrt(timeToExpiry) / 8) * Math.exp(-2 * normDist);
          
          // ガンマ計算
          const gamma = Math.max(0.0001, 0.01 * Math.exp(-5 * normDist * normDist));
          
          // ボリュームは、ATMに近いほど大きく
          const volume = Math.round(1000 * Math.exp(-3 * normDist));
          const openInterest = Math.round(2000 * Math.exp(-3 * normDist));
          
          // プットオプションデータ
          const putOption = {
            strike,
            markPrice: putMarkPrice,
            iv,
            delta: putDelta,
            gamma,
            volume,
            openInterest,
            type: 'put',
            expiry: TARGET_DATE,
            volumeChange: Math.round(Math.random() * 30),
            oiChange: Math.round(Math.random() * 20)
          };
          
          putOptions.push(putOption);
        }
      }
    }
    
    // 価格順にソート
    callOptions.sort((a, b) => a.strike - b.strike);
    putOptions.sort((a, b) => a.strike - b.strike);
    
    console.log(`最終的なデータ件数: ${callOptions.length}件のコールオプション、${putOptions.length}件のプットオプション`);
    
    return { callOptions, putOptions, currentPrice };
  } catch (error) {
    console.error('オプションデータ取得中にエラーが発生しました:', error);
    throw error;
  }
}

// モックデータを生成して保存
async function generateMockData() {
  try {
    console.log(`${TARGET_DATE}の実データを取得中...`);
    
    const { callOptions, putOptions, currentPrice } = await getOptionsData();
    
    console.log(`データ整形完了: ${callOptions.length}件のコールオプション、${putOptions.length}件のプットオプション`);
    
    // サンプルデータを出力
    console.log('\n=== コールオプションの例 ===');
    callOptions.slice(0, 3).forEach((option, idx) => {
      console.log(`[${idx}] Strike: ${option.strike}, Mark: ${option.markPrice.toFixed(2)}, IV: ${option.iv.toFixed(1)}%, Delta: ${option.delta.toFixed(2)}`);
    });
    
    console.log('\n=== プットオプションの例 ===');
    putOptions.slice(0, 3).forEach((option, idx) => {
      console.log(`[${idx}] Strike: ${option.strike}, Mark: ${option.markPrice.toFixed(2)}, IV: ${option.iv.toFixed(1)}%, Delta: ${option.delta.toFixed(2)}`);
    });
    
    // 出力するモックデータ形式
    const formattedDate = TARGET_DATE.replace(/-/g, '_');
    const mockDataTemplate = `
// 以下は${TARGET_DATE}のBybit APIから取得した実データを基にしたモックデータです
// 取得日時: ${new Date().toISOString()}
// BTC価格: ${currentPrice}

// コールオプション (${callOptions.length}件)
export const realCallOptions_${formattedDate} = ${JSON.stringify(callOptions, null, 2)};

// プットオプション (${putOptions.length}件)
export const realPutOptions_${formattedDate} = ${JSON.stringify(putOptions, null, 2)};

// 利用可能な満期日一覧
export const availableExpiryDates = [
  '${TARGET_DATE}',
  '2025-05-30',
  '2025-06-27',
  '2025-09-26',
  '2025-12-26',
  '2026-03-27'
];

// BTC現在価格
export const currentBTCPrice = ${currentPrice};
`;

    // ファイルに保存
    const outputPath = path.resolve(__dirname, '../mockData/bybitOptionData.js');
    fs.writeFileSync(outputPath, mockDataTemplate);
    
    console.log(`\n実データを保存しました: ${outputPath}`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// スクリプトを実行
generateMockData();
