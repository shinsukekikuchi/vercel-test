import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// Devnet で SOL をエアドロップするフック
export const useDevnetAirdrop = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  return async (amountSol = 0.2) => {
    if (!publicKey) throw new Error("Wallet not connected");
    await connection.requestAirdrop(publicKey, amountSol * LAMPORTS_PER_SOL);
  };
};
