export interface RawOrderHistoryEntry {
  // Core data fields that will be stored
  internalId: string; // Unique ID generated locally for this history entry (e.g., using uuid)
  apiOrderId?: string; // Order ID received from the Bybit API, if available
  clientOrderId?: string; // Client-supplied order ID, if you send one to Bybit

  symbol: string; // Market symbol, e.g., "BTCUSDT-7MAY25-91000-C"
  productType: 'USDT Option' | 'USDC Option' | string; // Product type, e.g., "USDT Option"

  orderType: 'Limit' | 'Market'; // The actual type of the order
  side: 'Buy' | 'Sell'; // Direction of the trade

  price?: number; // Price for Limit orders (e.g., 5.0)
  quantity: number; // Order quantity (e.g., 0.01)
  baseAsset: string; // The asset being traded (e.g., "BTC")
  quoteAsset: string; // The asset used for pricing (e.g., "USDT" or "USDC")

  // Information about execution
  filledQuantity: number; // Quantity that has been filled (e.g., 0.00 initially)
  // avgFilledPrice?: number; // Average price at which the order was filled (can be added later)

  // Calculated value based on order parameters
  // For a Limit order, this is typically price * quantity
  // e.g. for 0.01 BTC at 5.0 USDT/BTC, value is 0.05 USDT
  orderValue: number;

  // Optional parameters
  takeProfitPrice?: number;
  stopLossPrice?: number;
  isReduceOnly: boolean;

  timestamp: number; // JavaScript timestamp (milliseconds since epoch) when the order was recorded
}
