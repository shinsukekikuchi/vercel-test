import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './OptionsChart.css';
import { OptionData } from '../../mockData/optionsMock';
import { getIntensityColor, ChartStyles } from './colorUtils';

interface OptionsChartProps {
  data: OptionData[];
  currentPrice: number;
  cryptoSymbol?: 'BTC' | 'ETH' | 'SOL'; // 表示する暗号通貨のシンボル
  width?: number;
  height?: number;
  onOptionSelect?: (option: OptionData) => void;
}

/**
 * シンプルな単一ファイル版の OptionsChart。
 * D3 を直接使用してチャートを描画する。
 */
const OptionsChart: React.FC<OptionsChartProps> = ({
  data,
  currentPrice,
  cryptoSymbol = 'BTC', // デフォルト値をBTCに設定
  width = 960,
  height = 600,
  onOptionSelect,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedOption, setSelectedOption] = useState<OptionData | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(width);

  /* ---------------------------- ヘルパー ---------------------------- */
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  /* ---------------------------- レスポンシブ ---------------------------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      const newWidth = containerRef.current?.clientWidth ?? width;
      setContainerWidth(newWidth);
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [width]);

  /* ---------------------------- チャート描画 ---------------------------- */
  const drawChart = () => {
    if (!svgRef.current) return;

    const margin = { top: 60, right: 60, bottom: 80, left: 80 };
    const innerWidth = containerWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Tooltip delay timer
    let tooltipTimeout: number | null = null;

    // スケール計算のための準備
    const validData = data.filter(d => typeof d.strike === 'number' && isFinite(d.strike) && typeof d.markPrice === 'number' && isFinite(d.markPrice));
    console.log('[Chart] Filtered validData:', validData); // Log filtered data

    const [minStrike, maxStrike] = d3.extent(validData, d => d.strike);
    const [minMarkPrice, maxMarkPrice] = d3.extent(validData, d => d.markPrice);

    // デフォルトのドメイン (データがない場合に備える)
    const defaultStrikeDomain: [number, number] = [0, 100000];
    const defaultMarkPriceDomain: [number, number] = [0, 100];

    // strike ドメインの決定
    let strikeDomain: [number, number];
    if (minStrike !== undefined && maxStrike !== undefined) {
      const padding = (maxStrike - minStrike) === 0 ? Math.max(1, maxStrike * 0.1) : Math.max(100, (maxStrike - minStrike) * 0.05); // 最小/最大が同じ場合は幅を持たせる + 最小5%パディング
      strikeDomain = [minStrike - padding, maxStrike + padding];
    } else {
      strikeDomain = defaultStrikeDomain;
    }
    // currentPrice も domain に含める
    if (typeof currentPrice === 'number' && isFinite(currentPrice)) {
      strikeDomain = [Math.min(strikeDomain[0], currentPrice * 0.9), Math.max(strikeDomain[1], currentPrice * 1.1)];
    }

    // markPrice ドメインの決定 (Y軸は0から開始)
    let markPriceDomainMax: number;
    if (maxMarkPrice !== undefined) {
      markPriceDomainMax = maxMarkPrice === 0 ? defaultMarkPriceDomain[1] : maxMarkPrice * 1.1; // 最大値が0の場合も考慮
    } else {
      markPriceDomainMax = defaultMarkPriceDomain[1];
    }
    const markPriceDomain: [number, number] = [0, markPriceDomainMax];
    console.log('[Chart] Calculated markPriceDomain:', markPriceDomain); // Log calculated domain

    // スケール
    const xScale = d3
      .scaleLinear()
      .domain(strikeDomain) // 修正されたドメインを使用
      .range([0, innerWidth])
      .clamp(true); // 範囲外の値をクリップ
    const yScale = d3
      .scaleLinear()
      .domain(markPriceDomain) // 修正されたドメインを使用
      .range([innerHeight, 0])
      .clamp(true); // 範囲外の値をクリップ

    // SVG 初期化
    const svg = d3.select(svgRef.current).attr('width', containerWidth).attr('height', height);
    svg.selectAll('*').remove();

    // 背景
    svg
      .append('rect')
      .attr('width', containerWidth)
      .attr('height', height)
      .attr('fill', ChartStyles.colors.background)
      .attr('rx', ChartStyles.sizes.borderRadius)
      .attr('ry', ChartStyles.sizes.borderRadius);

    const chartGroup = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    chartGroup
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#1E1F2E')
      .attr('rx', 2)
      .attr('ry', 2);

    /* ---------------------------- 凡例 ---------------------------- */
    const legendData = [
      { label: 'Premium', color: ChartStyles.colors.timeValue },
    ];

    const legendGroup = chartGroup
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(0, -40)`);

    legendData.forEach((item, i) => {
      const g = legendGroup.append('g').attr('transform', `translate(${i * 120}, 0)`);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', item.color)
        .attr('stroke-width', 4)
        .attr('stroke-linecap', 'round');

      g.append('text')
        .attr('x', 26)
        .attr('y', 4)
        .attr('fill', ChartStyles.colors.legendText)
        .attr('font-size', ChartStyles.sizes.fontSize.small)
        .text(item.label);
    });

    /* ---------------------------- ヒートマップ凡例 ---------------------------- */
    const heatLegendWidth = 120;
    const heatLegendHeight = 8;
    const heatLegendGroup = chartGroup
      .append('g')
      .attr('class', 'heatmap-legend')
      .attr('transform', `translate(0, ${innerHeight + 20})`);
    // 凡例見出し: ヒートマップ強度を表示
    heatLegendGroup.append('text')
      .attr('x', 0)
      .attr('y', 20)
      .attr('fill', ChartStyles.colors.legendText)
      .attr('font-size', ChartStyles.sizes.fontSize.small)
      .text('Proximity to nearest option');
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      heatLegendGroup.append('rect')
        .attr('x', i * (heatLegendWidth / steps))
        .attr('y', 30)
        .attr('width', heatLegendWidth / steps)
        .attr('height', heatLegendHeight)
        .attr('fill', getIntensityColor(i / steps, true));
    }
    heatLegendGroup.append('text')
      .attr('x', 0)
      .attr('y', heatLegendHeight + 40)
      .attr('fill', ChartStyles.colors.legendText)
      .attr('font-size', ChartStyles.sizes.fontSize.small)
      .text('Low');
    heatLegendGroup.append('text')
      .attr('x', heatLegendWidth)
      .attr('y', heatLegendHeight + 40)
      .attr('text-anchor', 'end')
      .attr('fill', ChartStyles.colors.legendText)
      .attr('font-size', ChartStyles.sizes.fontSize.small)
      .text('High');

    /* ---------------------------- 軸 ---------------------------- */
    chartGroup
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => formatCurrency(d as number)).ticks(5))
      .selectAll('text')
      .style('fill', ChartStyles.colors.axis);

    chartGroup
      .append('g')
      .call(d3.axisLeft(yScale).tickFormat((d) => formatCurrency(d as number)).ticks(5))
      .selectAll('text')
      .style('fill', ChartStyles.colors.axis);

    chartGroup
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', ChartStyles.colors.axisLabel)
      .text('Strike Price (USDT)');

    chartGroup
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -70)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', ChartStyles.colors.axisLabel)
      .text('Mark Price (USDT)');

    /* ---------------------------- ヒートマップ ---------------------------- */
    const xGrid = 24;
    const yGrid = 15;
    const cellW = innerWidth / xGrid;
    const cellH = innerHeight / yGrid;

    // 強度スケールをデータ範囲から動的に計算
    const strikeRange = xScale.domain()[1] - xScale.domain()[0];
    const priceRange = yScale.domain()[1] - yScale.domain()[0];
    const intensityScale = Math.hypot(strikeRange, priceRange) / 4; // 調整係数

    for (let i = 0; i < xGrid; i++) {
      for (let j = 0; j < yGrid; j++) {
        const sx = xScale.invert(i * cellW);
        const sy = yScale.invert(j * cellH);

        // 近いオプションとの距離で強度を算出
        let minDist = Infinity;
        let closest: OptionData | null = null;
        data.forEach((o) => {
          const d = Math.hypot(o.strike - sx, (o.markPrice || 0) - sy);
          if (d < minDist) {
            minDist = d;
            closest = o;
          }
        });
        const intensity = closest ? Math.max(0, 1 - minDist / intensityScale) : 0;
        const rect = chartGroup
          .append('rect')
          .attr('class', 'heatmap-cell')
          .attr('x', i * cellW)
          .attr('y', j * cellH)
          .attr('width', cellW)
          .attr('height', cellH)
          .attr('fill', getIntensityColor(intensity, true))
          .attr('opacity', intensity * 0.35) // α 0.35 にさらに抑える
          .style('pointer-events', 'none')  // 点だけに Hover / Click を通す
          .attr('stroke-width', 0)
          .datum<OptionData | null>(closest);

        // ツールチップ表示
        rect
          .on('mouseover', (event, d: OptionData | null) => {
            if (!containerRef.current) return;
            const [x, y] = d3.pointer(event, containerRef.current);
            tooltipTimeout = window.setTimeout(() => {
              const tooltipSel = d3
                .select(tooltipRef.current)
                .style('display', 'block')
                .style('left', `${x + 10}px`)
                .style('top', `${y - 10}px`);

              if (d) {
                tooltipSel.html(
                  `<div class="tooltip-strike">Strike: ${formatCurrency(
                    d.strike,
                  )}</div><div class="tooltip-price">Price: ${formatCurrency(
                    (d.markPrice || 0),
                  )}</div>`,
                );
              } else {
                tooltipSel.html('<div>No data</div>');
              }
            }, 250);
          })
          .on('mouseout', () => {
            if (tooltipTimeout) {
              clearTimeout(tooltipTimeout);
              tooltipTimeout = null;
            }
            d3.select(tooltipRef.current).style('display', 'none');
          });
      }
    }

    /* ---------------------------- データポイント ---------------------------- */
    // Poor RRを除外
    const isPoorRR = (d: OptionData) => {
      const intrinsic = d.type === 'call' ? Math.max(0, currentPrice - d.strike) : Math.max(0, d.strike - currentPrice);
      const timeValPct = ((Math.max(0, (d.markPrice || 0) - intrinsic) / (d.markPrice || 1)) * 100);
      const rrRaw = (Math.abs((d.delta || 0) * 100) - Number(timeValPct));
      return rrRaw < -10;
    };

    // ユーザー向けにポイントを絞り込み: 現在価格±20%以内かつ出来高上位30件
    const filteredData = data
      .filter((d) => Math.abs(d.strike - currentPrice) / currentPrice < 0.2)
      .filter((d) => !isPoorRR(d))
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 15);

    // hover state helpers (先に定義して後で使用)
    const handleMouseOverPoint = (event: any, d: OptionData) => {
      if (!containerRef.current) return;
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
      }
      const hoveredElement = d3.select(event.target);
      chartGroup
        .selectAll<SVGCircleElement, OptionData>('.data-point')
        .transition()
        .duration(150)
        .attr('opacity', (p) => (p === d ? 1 : 0.3))
        .attr('stroke', (p) => (p === d ? 'white' : 'none'))
        .attr('stroke-width', (p) => (p === d ? 2 : 0))
        .attr('r', (p) => (p === d ? volumeScale((p.volume || 0)) * 1.5 : volumeScale(p.volume || 0))); // ホバー点を1.5倍に

      const [x, y] = d3.pointer(event, containerRef.current);
      tooltipTimeout = window.setTimeout(() => {
        const tooltipSel = d3
          .select(tooltipRef.current)
          .style('display', 'block')
          .style('left', `${x + 10}px`)
          .style('top', `${y - 10}px`);

        if (d) {
          tooltipSel.html(makeTooltipHtml(d));
        } else {
          tooltipSel.html('<div>No data</div>');
        }
      }, 250);
    };

    const handleMouseOutPoint = () => {
      chartGroup
        .selectAll<SVGCircleElement, OptionData>('.data-point')
        .transition()
        .duration(150)
        .attr('opacity', 1)
        .attr('stroke', 'none')
        .attr('stroke-width', 0)
        .attr('r', (p) => volumeScale(p.volume || 0)); // 元のサイズに戻す

      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
      }
      d3.select(tooltipRef.current).style('display', 'none');
    };

    // ボリュームスケール（円サイズに反映）
    const maxVolume = d3.max(filteredData, (d) => d.volume || 0) || 1;
    const volumeScale = d3
      .scaleSqrt<number, number>()
      .domain([0, maxVolume])
      .range([
        ChartStyles.sizes.pointRadius.small + 2,
        ChartStyles.sizes.pointRadius.large + 2,
      ]);

    chartGroup
      .selectAll('.data-point')
      .data(filteredData)
      .enter()
      .append('circle')
      .attr('class', (d) => {
        const intrinsic = d.type === 'call' ? Math.max(0, currentPrice - d.strike) : Math.max(0, d.strike - currentPrice);
        const timeVal = Math.max(0, (d.markPrice || 0) - intrinsic);
        const totalRisk = timeVal / (d.markPrice || 1);
        const isRecommend = Math.abs(d.strike - currentPrice) / currentPrice < 0.05 && totalRisk > 0.4 && totalRisk < 0.6;
        return isRecommend ? 'data-point clickable' : 'data-point';
      })
      .attr('cx', (d) => xScale(d.strike))
      .attr('cy', (d) => yScale(d.markPrice || 0))
      .attr('r', (d) => volumeScale(d.volume || 0)) // 初期半径
      .attr('fill', (d) => (d.type === 'call' ? ChartStyles.colors.call : ChartStyles.colors.put))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2.5)
      .style('filter', (d) =>
        d.type === 'call'
          ? 'drop-shadow(0 0 6px rgba(16,185,129,0.65))'
          : 'drop-shadow(0 0 6px rgba(239,68,68,0.65))',
      )
      .style('animation-delay', (d) => `${(((d.volume ?? 0) / maxVolume) * 2.4).toFixed(2)}s`)
      .attr('aria-label', (d) =>
        `${d.type === 'call' ? 'Call' : 'Put'} ${d.strike}K, Δ ${(d.delta || 0).toFixed(2)}, price ${formatCurrency(d.markPrice || 0)}`,
      )
      .attr('tabindex', 0)
      .on('mouseover', handleMouseOverPoint)
      .on('mouseout', handleMouseOutPoint)
      .on('click', (event, d) => {
        setSelectedOption(d);
        onOptionSelect?.(d);
      });

    const makeTooltipHtml = (d: OptionData) => {
      const intrinsic = d.type === 'call' ? Math.max(0, currentPrice - d.strike) : Math.max(0, d.strike - currentPrice);
      const timeValPct = ((Math.max(0, (d.markPrice || 0) - intrinsic) / (d.markPrice || 1)) * 100).toFixed(0);
      // risk-reward: delta×100 vs timeValPct 差を簡易指標
      const rrRaw = (Math.abs((d.delta || 0) * 100) - Number(timeValPct));
      const rrBadge = rrRaw > 10 ? `<span class="badge badge-bullish">Good RR</span>` : rrRaw < -10 ? `<span class="badge badge-bearish">Poor RR</span>` : `<span class="badge badge-neutral">Neutral</span>`;
      return `
        <div class="tooltip-row"><strong>Bid/Ask:</strong> ${d.bid ?? 'N/A'} / ${d.ask ?? 'N/A'}</div>
        <div class="tooltip-row"><strong>Volume:</strong> ${d3.format(",.0f")(d.volume ?? 0)}</div>
        <div class="tooltip-row"><strong>OI:</strong> ${d3.format(",.0f")(d.openInterest ?? 0)}</div>
        <div class="tooltip-row"><strong>IV:</strong> ${d.iv ? d3.format('.1%')(d.iv) : 'N/A'}</div>
        <div class="tooltip-rr">${rrBadge}</div>`;
    };

    // すべてのポイントを最前面に
    chartGroup.selectAll('.data-point').raise();

    /* --------- デルタ帯を示すガイドライン (0.25 / 0.50 / 0.75) --------- */
    const deltaThresholds = [0.25, 0.5, 0.75];
    const callOptions = data.filter((d) => d.type === 'call');
    if (callOptions.length) {
      deltaThresholds.forEach((thr) => {
        const closestCall = callOptions.reduce((prev, curr) =>
          Math.abs((curr.delta || 999) - thr) < Math.abs((prev.delta || 999) - thr) ? curr : prev,
        );
        if (closestCall) {
          const xPos = xScale(closestCall.strike);
          chartGroup
            .append('line')
            .attr('x1', xPos)
            .attr('x2', xPos)
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .attr('stroke', '#444')
            .attr('stroke-dasharray', '2 2');

          chartGroup
            .append('text')
            .attr('x', xPos + 4)
            .attr('y', 12)
            .attr('fill', '#666')
            .attr('font-size', 10)
            .text(`Δ ${thr}`);
        }
      });
    }

    /* ---------------------------- データライン ---------------------------- */
    const sortedData = [...data].sort((a, b) => a.strike - b.strike);
    const lineGenerator = d3
      .line<OptionData>()
      .x((d) => xScale(d.strike))
      .y((d) => yScale(d.markPrice || 0))
      .defined(d => typeof d.strike === 'number' && isFinite(d.strike) && typeof d.markPrice === 'number' && isFinite(d.markPrice)) // NaN/undefinedをスキップ
      .curve(d3.curveMonotoneX);

    // データが存在する場合のみラインを描画
    if (validData.length > 0 && strikeDomain[0] < strikeDomain[1] && markPriceDomain[1] > 0) {
      chartGroup
        .append('path')
        .datum(validData.sort((a, b) => a.strike - b.strike)) // Ensure data is sorted for line
        .attr('class', 'price-line')
        .attr('fill', 'none')
        .attr('stroke', ChartStyles.colors.timeValue)
        .attr('stroke-width', ChartStyles.sizes.lineWidth.normal)
        .attr('stroke-opacity', 0.8)
        .attr('d', lineGenerator);
    } else {
      console.warn('[Chart] Skipping price line drawing: No valid data or invalid domain.');
    }

    /* ---------------------------- 現在価格線 ---------------------------- */
    // 現在価格が有効で、strikeドメインが有効な場合のみ線とテキストを描画
    if (typeof currentPrice === 'number' && isFinite(currentPrice) && strikeDomain[0] < strikeDomain[1]) {
      const currentPriceX = xScale(currentPrice);
      chartGroup
        .append('line')
        .attr('x1', currentPriceX)
        .attr('x2', currentPriceX)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', ChartStyles.colors.currentPrice)
        .attr('stroke-dasharray', '4 4');

      // ラベル（縦線の上部）
      chartGroup
        .append('text')
        .attr('x', currentPriceX + 6)
        .attr('y', -6) // Position above the top margin line
        .attr('fill', ChartStyles.colors.currentPrice)
        .attr('font-size', ChartStyles.sizes.fontSize.small)
        .text(`${cryptoSymbol}: ${formatCurrency(currentPrice)}`); // 選択された暗号通貨シンボルを表示
    } else {
      console.warn('[Chart] Skipping current price line/text: Invalid currentPrice or strike domain.');
    }

    /* ---------------------------- ヒートマップ背景 ---------------------------- */
  };

  /* ---------------------------- Effect ---------------------------- */
  useEffect(() => {
    console.log('[Chart] Received data:', data); // Log received data
    if (data.length) drawChart();
  }, [data, currentPrice, containerWidth]);

  /* ---------------------------- JSX ---------------------------- */
  return (
    <div className="options-chart-container" ref={containerRef}>
      <svg ref={svgRef} width={width} height={height} />
      <div className="tooltip" ref={tooltipRef} />
    </div>
  );
};

export default OptionsChart;
