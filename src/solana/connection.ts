import { Connection, clusterApiUrl } from "@solana/web3.js";

// Solana Devnet への接続インスタンス
export const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
