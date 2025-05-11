import Header from "../components/layout/Header";
import Body from "../components/layout/Body";
// import History from "components/features/history"; // Old import removed
import HistoryDisplayTable from "../components/HistoryDisplayTable"; // New import added

// Removed OptionOrderHistoryProvider; using local OptionTradesProvider for history

export default function HistoryPage() {
  return (
    <div>
      <Header />
      <Body>
        {/* <History /> */}
        <HistoryDisplayTable /> {/* Use the new component */}
      </Body>
    </div>
  );
}
