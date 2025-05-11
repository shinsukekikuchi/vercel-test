import { connection } from "./connection";
import { MINT } from "./faucet";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

/**
 * USDC-DEV の残高を取得するユーティリティ
 * @param publicKey SOLana ウォレットの PublicKey
 * @returns USDC-DEV の残高 (uiAmount)
 */
export async function getUsdcDevBalance(
  publicKey: PublicKey
): Promise<number> {
  const ata = getAssociatedTokenAddressSync(MINT, publicKey, false);
  const acct = await connection.getParsedAccountInfo(ata);
  // @ts-ignore
  return acct.value?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
}
