import { Link } from "react-router-dom";
import '@solana/wallet-adapter-react-ui/styles.css';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useState } from "react";
import { useDevnetAirdrop } from "hooks/useDevnetAirdrop";
import { useUsdcDevFaucet } from "solana/faucet";

export default function Header() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [isRequesting, setIsRequesting] = useState(false);
  const [showQRPopover, setShowQRPopover] = useState(false);
  const requestSol = useDevnetAirdrop();
  const requestUsdc = useUsdcDevFaucet();
  const [isRequestingUsdc, setIsRequestingUsdc] = useState(false);

  return (
    <header className="bg-dark shadow-sm">
      <nav className="max-w-6xl mx-auto">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link
              to="/"
              className="text-xl flex items-center gap-1.5 font-bold text-white"
            >
              <img src="/Favicon.png" alt="logo" className="w-6 h-6" />
              FunOption
            </Link>
          </div>
          <div className="flex gap-5 items-center">
            <Link to="/ai-chat" className="text-white">
              AI Chat
            </Link>
            <Link to="/profile" className="text-white">
              History
            </Link>

            <div className="relative">

              {/* QR 코드 팝오버 */}
              {showQRPopover && (
                <div className="fixed right-8 top-8 bg-dark rounded-2xl overflow-hidden shadow-lg z-50 w-[280px]">
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQRPopover(false);
                      }}
                      className="text-gray-500 hover:text-gray-700 bg-dark rounded-full p-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div
                    onClick={() =>
                      window.open(
                        "https://discord.com/invite/sWgxD22FdQ",
                        "_blank"
                      )
                    }
                    className="cursor-pointer"
                  >
                    <img
                      src="/images/qrs.png"
                      alt="qrcodes"
                      className="w-full h-full object-contain -mr-4"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Solana Wallet Adapter */}
            <WalletMultiButton className="btn-primary" />

            <button
              disabled={!publicKey || isRequestingUsdc}
              className="btn-ghost"
              onClick={async () => {
                setIsRequestingUsdc(true);
                if (publicKey) {
                  const balance = await connection.getBalance(publicKey);
                  if (balance < 0.1 * LAMPORTS_PER_SOL) {
                    await requestSol();
                  }
                }
                await requestUsdc();
                setIsRequestingUsdc(false);
              }}
            >
              {isRequestingUsdc ? "Minting USDC..." : "Request USDC"}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
