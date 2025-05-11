import 'dotenv/config';
import { bybitClient } from './bybit.js';

// Bybit APIのテスト関数
async function testBybitAPI() {
  try {
    console.log('=== Bybit Testnet API テスト開始 ===');
    
    // 1. マーケットデータの取得
    console.log('\n1. マーケットデータの取得:');
    const marketData = await bybitClient.getMarketData('BTCUSDT');
    console.log('マーケットデータ:', JSON.stringify(marketData, null, 2));
    
    // 2. K線データの取得
    console.log('\n2. K線データの取得:');
    const klineData = await bybitClient.getKlineData('BTCUSDT', '1d', 5);
    console.log('K線データ:', JSON.stringify(klineData, null, 2));
    
    // 3. アカウント情報の取得
    console.log('\n3. アカウント情報の取得:');
    const accountInfo = await bybitClient.getAccountInfo();
    console.log('アカウント情報:', JSON.stringify(accountInfo, null, 2));
    
    console.log('\n=== Bybit Testnet API テスト完了 ===');
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

// テスト実行
testBybitAPI();
