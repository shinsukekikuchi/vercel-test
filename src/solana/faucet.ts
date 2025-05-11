import idl from "../../public/spl_token_faucet.json";
import { Program, AnchorProvider, BN } from "@project-serum/anchor";
import { PublicKey, SendTransactionError } from "@solana/web3.js";
import { connection } from "./connection";
import { useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const PROGRAM_ID = new PublicKey("4sN8PnN2ki2W4TFXAfzR645FWs8nimmsYeNtxM8RBK6A");
export const MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

// USDC-DEV faucet呼び出しフック
export const useUsdcDevFaucet = () => {
  const wallet = useWallet();

  const requestUsdc = async (amount: number = 1000000) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      console.error("Wallet not connected");
      alert("Wallet not connected");
      return;
    }

    // AnchorProvider と Program の初期化は try の外でもOK
    const provider = new AnchorProvider(connection, wallet as any, {
      preflightCommitment: "confirmed",
      commitment: "confirmed",
    });
    const program = new Program(idl as any, PROGRAM_ID, provider);

    try {
      // 受け取り用の Associated Token Account (ATA) を計算
      const ata = getAssociatedTokenAddressSync(
        MINT,             // どのトークンか (USDC-DEV)
        wallet.publicKey, // 誰のウォレットか
        false             // ATAが存在しなくてもエラーにしない (通常false)
      );
      console.log("Destination ATA:", ata.toBase58());

      // ミントPDAとバンプを計算
      const [mintPda, mintBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("faucet-mint")],
        PROGRAM_ID
      );
      console.log("Mint PDA:", mintPda.toBase58(), "Bump:", mintBump);

      console.log("Sending airdrop transaction via rpc()...");
      const signature = await program.methods
        .airdrop(mintBump, new BN(amount * 1_000_000)) // ミントバンプを追加、6 decimals
        .accounts({
          mint: MINT,
          destination: ata,
          payer: wallet.publicKey,
          receiver: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc({
          skipPreflight: false,
          commitment: "confirmed",
        });

      console.log("Airdrop transaction successful:", signature);
      alert(`Successfully minted ${amount} USDC-DEV! Transaction: ${signature}`);
    } catch (error) {
      console.error("Airdrop failed:", error);

      // ★ エラーの詳細ログを取得する試みを追加
      let detailedLogs = "";
      if (error instanceof SendTransactionError) {
        // getLogs() は Promise を返す可能性があるため、await を使用
        // ただし、catch ブロック内での非同期処理は注意が必要
        // ここでは、ログ取得を試みるが、完了を待たずに処理を進める可能性もある
        // より堅牢にするなら、ログ取得用の非同期関数を定義し呼び出す
        try {
          detailedLogs = (await error.getLogs(connection))?.join("\n") ?? "No logs available.";
          console.error("Transaction Logs:\n", detailedLogs);
        } catch (logError) {
          console.error("Failed to get transaction logs:", logError);
        }
      }

      if (error instanceof Error && error.message.includes("custom program error")) {
        const errorCodeMatch = error.message.match(/custom program error: (0x[0-9a-fA-F]+)/);
        const errorCode = errorCodeMatch ? errorCodeMatch[1] : "unknown";
        alert(`Airdrop failed: Program Error ${errorCode}. Check console for details.`);
        // 詳細ログがあれば表示
        if (detailedLogs) {
          alert(`Detailed Logs:\n${detailedLogs.substring(0, 300)}${detailedLogs.length > 300 ? '...' : ''}`); // アラートが長くなりすぎないように制限
        }
      } else if (error instanceof Error && error.name.includes("Wallet")) {
        alert(`Transaction signing failed: ${error.message}`);
      } else {
        alert(`Airdrop failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  return requestUsdc;
};
