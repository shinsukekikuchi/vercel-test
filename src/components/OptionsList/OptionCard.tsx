import React from 'react';
import { OptionData } from 'providers/OptionsDataProvider';
import { ChartStyles } from '../OptionsChart/colorUtils';

interface OptionCardProps {
  option: OptionData;
  underlyingPrice: number | null;
  aiDescription?: string;
  onPurchaseClick: (option: OptionData) => void;
}

const OptionCard: React.FC<OptionCardProps> = ({
  option,
  underlyingPrice,
  aiDescription = 'AI analysis suggests this option has potential based on current market conditions and technical indicators.',
  onPurchaseClick,
}) => {
  const assetName = option.symbol.split('-')[0];
  const markPriceNum = option.markPrice !== null && option.markPrice !== undefined ? parseFloat(String(option.markPrice)) : NaN;

  // Calculate Estimated Return
  let displayEstReturn: string;
  if (underlyingPrice !== null && option.delta !== null && option.delta !== undefined && !isNaN(markPriceNum) && markPriceNum !== 0) {
    const hypotheticalPriceChange = underlyingPrice * 0.01; // 1% hypothetical change
    const estimatedOptionPriceChange = option.delta * hypotheticalPriceChange;
    const estimatedReturnPercent = (estimatedOptionPriceChange / markPriceNum) * 100;
    displayEstReturn = `${estimatedReturnPercent >= 0 ? '+' : ''}${estimatedReturnPercent.toFixed(1)}%`;
  } else {
    displayEstReturn = 'N/A';
  }

  // Determine Risk Level
  let displayRiskLevel: 'Low' | 'Medium' | 'High';
  if (option.delta !== null && option.delta !== undefined) {
    const absDelta = Math.abs(option.delta);
    if (absDelta < 0.3) {
      displayRiskLevel = 'High';
    } else if (absDelta < 0.7) {
      displayRiskLevel = 'Medium';
    } else {
      displayRiskLevel = 'Low';
    }
  } else {
    displayRiskLevel = 'Medium'; // Default if delta is not available
  }

  const riskLevelColorStyle = displayRiskLevel === 'Low' ? { color: ChartStyles.colors.call } :
                            displayRiskLevel === 'High' ? { color: ChartStyles.colors.put } :
                            {}; // Medium uses Tailwind class
  const riskLevelMediumClassName = displayRiskLevel === 'Medium' ? 'text-yellow-400' : '';

  return (
    <div
      className="p-6 rounded-lg shadow-xl text-white border"
      style={{
        backgroundColor: ChartStyles.colors.background,
        borderColor: ChartStyles.colors.gridLine
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <span
            className="px-2 py-0.5 text-xs font-semibold rounded-full" // Base Tailwind styles
            style={{
              backgroundColor: option.type === 'call' ? ChartStyles.colors.call : ChartStyles.colors.put,
              color: ChartStyles.colors.axis, // Text color from ChartStyles
            }}
          >
            {option.type.toUpperCase()}
          </span>
          <h2 className="text-xl font-bold mt-1">
            {assetName} ${option.strike.toLocaleString()}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Expiry: {option.expiry}</div>
          {underlyingPrice && (
            <div className="text-xs text-gray-400">Current {assetName} Price: ${underlyingPrice.toLocaleString()}</div>
          )}
          <div
            className="mt-1 px-2 py-1 text-white text-xs font-semibold rounded shadow-md"
            style={{ backgroundColor: ChartStyles.colors.recommend }}
          >
            AI Pick
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-4">
        {aiDescription}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-4 text-center">
        <div>
          <div className="text-xs text-gray-400">Premium</div>
          <div
            className="text-lg font-semibold"
            style={{ color: ChartStyles.colors.recommend }}
          >
            ${!isNaN(markPriceNum) ? markPriceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Est. Return</div>
          <div
            className={`text-lg font-semibold`}
            style={{ color: displayEstReturn === 'N/A' || displayEstReturn.startsWith('-') ? ChartStyles.colors.put : ChartStyles.colors.call }}
            // Assign red for N/A or negative, green for positive for Est. Return
          >
            {displayEstReturn}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Risk Level</div>
          <div
            className={`text-lg font-semibold ${riskLevelMediumClassName}`}
            style={riskLevelColorStyle}
          >
            {displayRiskLevel}
          </div>
        </div>
      </div>

      <button
        className="w-full text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 flex items-center justify-center gap-2"
        style={{
          backgroundColor: ChartStyles.colors.recommend,
          borderColor: ChartStyles.colors.recommend, // Ensure ring color matches if not specified via Tailwind
          // For focus:ring-purple-500, we might need to map ChartStyles.colors.recommend to a Tailwind shade or use a custom ring color
        }}
        onClick={() => onPurchaseClick(option)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
        Purchase This Option
      </button>
    </div>
  );
};

export default OptionCard;
