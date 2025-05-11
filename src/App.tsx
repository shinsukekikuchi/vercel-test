import { Routes, Route, BrowserRouter } from "react-router-dom";
import HistoryPage from "pages/history";
import OptionsPage from "pages/options"; 
import AIAdvisorPage from "pages/AIAdvisorPage"; 
import { OptionsProvider } from "./providers/OptionsDataProvider";
import { SnackbarProvider } from "components/SnackbarProvider";
import { OptionTradesProvider } from "providers/OptionTradesProvider";
import { SolanaWalletProvider } from "solana/WalletProvider";

function App() {
  return (
    <SolanaWalletProvider>
      <OptionsProvider>
        <SnackbarProvider>
          <OptionTradesProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<OptionsPage />} /> 
                <Route path="/profile" element={<HistoryPage />} />
                <Route path="/ai-chat" element={<AIAdvisorPage />} /> 
              </Routes>
            </BrowserRouter>
          </OptionTradesProvider>
        </SnackbarProvider>
      </OptionsProvider>
    </SolanaWalletProvider>
  );
}

export default App;
