import React, { useState, useEffect } from 'react';
import { OptionData } from '../providers/OptionsDataProvider';
import { ChartStyles } from './OptionsChart/colorUtils';
import './OptionTradePanel.css';
import type { OptionOrderParams, CreateOrderResultData } from '../api/bybit';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { SnackbarType } from './SnackbarProvider'; // Adjusted path
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createBurnCheckedInstruction, getAssociatedTokenAddress, createCloseAccountInstruction } from '@solana/spl-token';
import { clusterApiUrl } from '@solana/web3.js'; // clusterApiUrl をインポート
import { saveOrderToHistory } from '../utils/localStorageHistory';
import type { RawOrderHistoryEntry } from '../types/orderHistory';

// Helper function for number formatting
const formatNumber = (
  value: number | undefined,
  decimals: number,
  useGrouping: boolean = true
): string => {
  if (value === undefined || isNaN(value)) {
    return '-';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: useGrouping,
  });
};

interface OptionTradePanelProps {
  option: OptionData | null;
  wallet: WalletContextState;
  showSnackbar: (message: string, type: SnackbarType) => void;
  onClose: () => void;
}

const OptionTradePanel: React.FC<OptionTradePanelProps> = ({ option, wallet, showSnackbar, onClose }) => {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [lotSize, setLotSize] = useState<number>(0.01);
  // Display price as TOTAL cost (= unit price * lotSize)
  const initPrice = (() => {
    const unit = option?.markPrice ?? 0;
    const roundedUnit = Math.round(unit / 5) * 5;
    return roundedUnit * 0.01; // default lotSize 0.01
  })();
  const [price, setPrice] = useState<number>(initPrice);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sideMultiplier = side === 'buy' ? 1 : -1;

  // Recalculate displayed total cost when selected option or lot size changes
  useEffect(() => {
    if (!option) {
      setPrice(0);
      return;
    }
    const unit = option.markPrice ?? 0;
    const roundedUnit = Math.round(unit / 5) * 5;
    setPrice(roundedUnit * lotSize);
  }, [option, lotSize]);

  // Fallback converter: build a Bybit symbol if option.symbol is not provided
  const buildBybitSymbol = (opt: OptionData): string => {
    const [yyyy, mm, dd] = opt.expiry.split('-');
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[Number(mm) - 1];
    const yy = yyyy.slice(2);
    const typeCode = opt.type === 'call' ? 'C' : 'P';
    return `BTC-${dd}${month}${yy}-${opt.strike}-${typeCode}`;
  };

  const handleConfirm = async () => {
    if (!option) return;
    setIsSubmitting(true);

    const totalCost = price;
    const unitPrice = lotSize > 0 ? totalCost / lotSize : 0;

    const { bybitClient } = await import('../api/bybit');
    const orderType = unitPrice > 0 ? 'Limit' : 'Market'; // Use unitPrice to determine orderType

    const params: OptionOrderParams = {
      symbol: option.symbol ?? buildBybitSymbol(option),
      side: side === 'buy' ? 'Buy' : 'Sell',
      qty: lotSize.toString(),
      ...(unitPrice > 0 ? { price: unitPrice.toString() } : {}), // send unit price
      orderType,
      timeInForce: 'GTC',
      orderLinkId: `web_${Date.now()}`,
    };
    try {
      const result = await bybitClient.createOptionOrder(params);
      console.log('Order placed result:', result);
      if (result.retCode === 0 && result.result?.orderId && option) { // Order Success and option is not null
        showSnackbar(`Order placed: ${result.result.orderId}`, 'success');

        // Build RawOrderHistoryEntry (partial fields populated)
        const orderDetails: Omit<RawOrderHistoryEntry, 'internalId'> = {
          apiOrderId: result.result.orderId,
          clientOrderId: params.orderLinkId,
          symbol: option.symbol ?? buildBybitSymbol(option),
          productType: 'USDC Option', // default; adjust if needed
          orderType: orderType as 'Limit' | 'Market',
          side: side === 'buy' ? 'Buy' : 'Sell',
          price: totalCost,
          quantity: lotSize,
          baseAsset: 'BTC',
          quoteAsset: 'USDC',
          filledQuantity: 0,
          orderValue: totalCost,
          takeProfitPrice: undefined,
          stopLossPrice: undefined,
          isReduceOnly: false,
          timestamp: Date.now(),
        };

        saveOrderToHistory(orderDetails);

        console.log('Order saved to localStorage via util:', orderDetails);

        // USDC Burn Logic
        const SOLANA_RPC_URL = clusterApiUrl('devnet');
        const USDC_MINT_ADDRESS = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'; // Devnet USDC Mint Address

        if (wallet && wallet.publicKey && wallet.signTransaction && wallet.sendTransaction) {
          try {
            const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
            const usdcMintPublicKey = new PublicKey(USDC_MINT_ADDRESS);
            // Ensure price and lotSize are numbers and calculate amount to burn
            // Assuming USDC has 6 decimal places
            const amountToBurn = Math.round(totalCost * 1_000_000); // total cost already

            if (amountToBurn > 0) {
              const associatedTokenAccountAddress = await getAssociatedTokenAddress(
                usdcMintPublicKey,
                wallet.publicKey
              );

              const transaction = new Transaction().add(
                createBurnCheckedInstruction(
                  associatedTokenAccountAddress, // account
                  usdcMintPublicKey,      // mint
                  wallet.publicKey,       // owner
                  amountToBurn,           // amount
                  6,                      // decimals
                  [],                     // multiSigners
                  TOKEN_PROGRAM_ID        // programId
                )
              );

              // Optional: If you want to close the token account if it's empty after burning
              // const tokenAccountInfo = await connection.getAccountInfo(associatedTokenAccount);
              // if (tokenAccountInfo && tokenAccountInfo.data.length > 0) {
              //   const tokenAccountData = AccountLayout.decode(tokenAccountInfo.data);
              //   if (tokenAccountData.amount === BigInt(0)) {
              //     transaction.add(
              //       createCloseAccountInstruction(
              //         associatedTokenAccount, wallet.publicKey, wallet.publicKey, []
              //       )
              //     );
              //   }
              // }

              const signature = await wallet.sendTransaction(transaction, connection);
              await connection.confirmTransaction(signature, 'confirmed');
              showSnackbar(`Successfully burned ${amountToBurn / 1_000_000} USDC. Tx: ${signature}`, 'success');
            } else {
              showSnackbar('Burn amount is zero, skipping burn.', 'info');
            }
          } catch (burnError: any) {
            console.error('USDC Burn failed:', burnError);
            showSnackbar(`USDC Burn failed: ${burnError.message}`, 'error');
          }
        }

        onClose();
      } else {
        const errorMsg = result.retMsg || 'Unknown Bybit API error';
        showSnackbar(`Order failed: ${errorMsg} (Code: ${result.retCode})`, 'error');
      }
    } catch (e: any) {
      const message = e.response?.data?.retMsg || e.message || JSON.stringify(e);
      showSnackbar(`Order failed: ${message}`, 'error');
    }
    setIsSubmitting(false);
  };

  if (!option) return null;

  return (
    <div className={`option-trade-panel`} aria-hidden={!option}>
      {/* Header */}
      <div className="panel-header">
        <h2>{side === 'buy' ? 'Buy' : 'Sell'} {option.type.toUpperCase()} {formatNumber(option.strike, 0)}</h2>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      {/* Side Switch */}
      <div className="toggle-group">
        <button
          className={`buy-btn ${side === 'buy' ? 'active' : ''}`}
          style={{ background: ChartStyles.colors.call, opacity: side === 'buy' ? 1 : 0.7 }}
          onClick={() => setSide('buy')}
        >
          Buy
        </button>
        <button
          className={`sell-btn ${side === 'sell' ? 'active' : ''}`}
          style={{ background: ChartStyles.colors.put, opacity: side === 'sell' ? 1 : 0.7 }}
          onClick={() => setSide('sell')}
        >
          Sell
        </button>
      </div>

      {/* Price and Size */}
      <h3 className="section-header">Price / Size</h3>

      <div className="input-group">
        <label>Price (USDC)</label>
        <input
          type="number"
          min={0}
          step={5}
          value={price.toString()} // Display as integer string
          onChange={(e) => {
            const inputValue = Number(e.target.value);
            setPrice(Math.round(inputValue / 5) * 5); // Round to nearest 5 and update state
          }}
        />
        <button onClick={() => setPrice((p) => Math.max(0, p - 5))}>-</button>
        <button onClick={() => setPrice((p) => p + 5)}>+</button>
      </div>

      <div className="input-group">
        <label>Size (BTC)</label>
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={lotSize}
          onChange={(e) => setLotSize(Number(e.target.value))}
        />
        <button onClick={() => setLotSize((s) => Math.max(0.01, parseFloat((s - 0.01).toFixed(2))))}>-</button>
        <button onClick={() => setLotSize((s) => parseFloat((s + 0.01).toFixed(2)))}>+</button>
      </div>

      {/* Price Information */}
      <h3 className="section-header">Price Information</h3>
      <div className="price-info">
        <div><span>Mark Price</span><span>{formatNumber(option.markPrice, 2)}</span></div>
        <div><span>Bid</span><span>{formatNumber(option.bid, 2)}</span></div>
        <div><span>Ask</span><span>{formatNumber(option.ask, 2)}</span></div>
      </div>

      {/* Greeks */}
      <h3 className="section-header">Greeks</h3>
      <div className="greeks-info">
        <div><span>Gamma</span><span>{formatNumber(option.gamma !== undefined ? option.gamma * sideMultiplier : undefined, 4)}</span></div>
        <div><span>Theta</span><span>{formatNumber(option.theta !== undefined ? option.theta * sideMultiplier : undefined, 4)}</span></div>
      </div>

      {/* Confirm */}
      <button
        className="confirm-btn"
        style={{ background: side === 'buy' ? ChartStyles.colors.call : ChartStyles.colors.put }}
        disabled={isSubmitting || lotSize < 0.01} // Ensure lotSize is valid
        onClick={handleConfirm}
      >
        {isSubmitting ? 'Placing…' : 'Confirm'}
      </button>
    </div>
  );
};

export default OptionTradePanel;
