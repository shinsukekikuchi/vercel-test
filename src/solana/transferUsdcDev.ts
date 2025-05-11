import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram, // SystemProgram は transfer SOL の際に使うことが多いですが、SPLトークン転送では直接は使いません。
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  // transfer, // transfer は @solana/spl-token v0.2.0 以降で非推奨になったため、createTransferInstruction を使います
} from "@solana/spl-token";
import { AnchorProvider } from "@project-serum/anchor"; // provider を受け取る想定

// USDC-DEVのミントアドレス (faucet.ts から取得)
export const USDC_DEV_MINT_ADDRESS = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

// 仮の送金先公開鍵（実際のテスト時には、ご自身で管理するDevnetウォレットアドレスに置き換えてください）
// ここでは一時的に Solana System Program ID を使用しています。このアドレスにUSDC-DEVを送っても意味はありません。
export const PLACEHOLDER_DESTINATION_PUBLIC_KEY = new PublicKey(
  "11111111111111111111111111111111" // Solana System Program ID (有効な公開鍵形式)
);


/**
 * 指定された量のUSDC-DEVトークンをユーザーのウォレットから指定された宛先アドレスへ送金します。
 *
 * @param provider AnchorProvider - ウォレット接続とトランザクション署名に使用
 * @param amount 送金するUSDC-DEVの量 (UIで表示される単位。6桁のdecimalsを考慮して内部で調整します)
 * @param destinationAddress 送金先のSolana公開鍵文字列
 * @returns トランザクション署名 (成功時)
 * @throws エラー (失敗時)
 */
export async function transferUsdcDev(
  provider: AnchorProvider,
  amount: number,
  destinationAddress: string // 文字列として受け取り、内部で PublicKey に変換
): Promise<string> {
  if (!provider.wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const connection = provider.connection;
  const sourcePublicKey = provider.wallet.publicKey;
  const destinationPublicKey = new PublicKey(destinationAddress);

  // 送金元のトークンアカウント (ATA) を取得
  const sourceAta = getAssociatedTokenAddressSync(
    USDC_DEV_MINT_ADDRESS,
    sourcePublicKey,
    false // allowOwnerOffCurve: false (通常)
  );

  // 送金先のトークンアカウント (ATA) を取得
  // 注意: 送金先にも ATA が存在する必要があります。存在しない場合、事前に作成するか、
  // createAssociatedTokenAccountInstruction をトランザクションに含める必要があります。
  // 今回はシンプル化のため、送金先のATAは既に存在すると仮定します。
  // 本番環境では、送金先ATAが存在しない場合の処理も考慮が必要です。
  const destinationAta = getAssociatedTokenAddressSync(
    USDC_DEV_MINT_ADDRESS,
    destinationPublicKey,
    false // allowOwnerOffCurve: false
  );

  // USDC-DEVは6桁のdecimalsを持つと仮定 (BybitのUSDCや一般的なUSDCに倣う)
  // faucet.ts の airdrop でも amount * 1_000_000 となっていたため、これに合わせます。
  const amountToSend = Math.floor(amount * 1_000_000); // 小数点以下を切り捨て

  if (amountToSend <= 0) {
    throw new Error("Amount must be greater than 0.");
  }

  const transaction = new Transaction().add(
    createTransferInstruction(
      sourceAta,          // 送金元のATA
      destinationAta,     // 送金先のATA
      sourcePublicKey,    // 送金元ATAの所有者 (ユーザーのウォレット)
      amountToSend,       // 送金量 (decimals調整済み)
      [],                 // Multi-signers (今回はなし)
      TOKEN_PROGRAM_ID    // SPL Token Program ID
    )
  );

  // トランザクションに最新のブロックハッシュを設定
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  // 手数料支払者を設定
  transaction.feePayer = sourcePublicKey;

  // ウォレットに署名を要求
  const signedTransaction = await provider.wallet.signTransaction(transaction);

  // トランザクションを送信し、確認を待つ
  const signature = await connection.sendRawTransaction(
    signedTransaction.serialize()
  );
  await connection.confirmTransaction(signature, "confirmed");

  console.log(
    `Successfully transferred ${amount} USDC-DEV from ${sourcePublicKey.toBase58()} to ${destinationAddress}. Transaction: ${signature}`
  );
  return signature;
}
