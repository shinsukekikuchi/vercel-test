import React, { useState } from 'react';
import Header from "../components/layout/Header";
import AIChat from '../components/AIChat/AIChat';
import AIRecommendedOptionsList from '../components/OptionsList/AIRecommendedOptionsList';
import OptionTradePanel from '../components/OptionTradePanel';
import { OptionData } from '../providers/OptionsDataProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSnackbar } from '../components/SnackbarProvider';

const AIAdvisorPage: React.FC = () => {
  const wallet = useWallet();
  const { showSnackbar } = useSnackbar();

  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [selectedOptionForTrade, setSelectedOptionForTrade] = useState<OptionData | null>(null);

  const handleOpenTradePanel = (option: OptionData) => {
    console.log('handleOpenTradePanel called with option:', option); // DEBUG
    if (!wallet.connected) {
      showSnackbar('Please connect your Solana wallet first to trade.', 'info');
      return;
    }
    setSelectedOptionForTrade(option);
    setIsTradePanelOpen(true);
    console.log('isTradePanelOpen set to true, selectedOptionForTrade set'); // DEBUG
  };

  const handleCloseTradePanel = () => {
    console.log('handleCloseTradePanel called'); // DEBUG
    setIsTradePanelOpen(false);
    setSelectedOptionForTrade(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: AI Recommended Options */}
        <div className="w-2/3 p-6 overflow-y-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-1 text-white">AI Recommended Options</h1>
            <p className="text-md text-gray-400">Curated options tailored to your trading style, powered by AI.</p>
          </div>
          <AIRecommendedOptionsList
            onPurchaseClick={handleOpenTradePanel}
          />
        </div>

        {/* Right Column: AI Chat */}
        <div className="w-1/3 border-l border-gray-700 flex flex-col p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">AI Advisor Chat</h2>
            <p className="text-sm text-gray-400">Get personalized options trading advice</p>
          </div>
          <div className="flex-grow h-0">
            <AIChat />
          </div>
        </div>
      </div>

      {/* Trade Panel Modal */}
      {isTradePanelOpen && selectedOptionForTrade && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={handleCloseTradePanel} // Close when clicking overlay
        >
          <div
            className="bg-gray-850 p-1 rounded-xl shadow-3xl max-w-lg w-full transform transition-all duration-300 ease-out scale-95 hover:scale-100"
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside modal content
          >
            <OptionTradePanel
              option={selectedOptionForTrade}
              wallet={wallet}
              onClose={handleCloseTradePanel}
              showSnackbar={showSnackbar}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAdvisorPage;
