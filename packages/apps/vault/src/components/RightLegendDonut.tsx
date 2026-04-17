type DonutItem = {
  label: string;
  value: number;
  color: string;
};

type RightLegendDonutProps = {
  items: DonutItem[];
  compact?: boolean;
  showPct?: boolean;
  showCenter?: boolean;
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (value: number) => string;
  legendPosition?: 'right' | 'bottom';
  showLegend?: boolean;
};

const defaultFormatter = (value: number) => Math.round(value).toLocaleString('en-IN');

export function RightLegendDonut({
  items,
  compact = false,
  showPct = true,
  showCenter = false,
  centerLabel = 'TOTAL',
  centerValue,
  valueFormatter = defaultFormatter,
  legendPosition = 'right',
  showLegend = true,
}: RightLegendDonutProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const normalized = total > 0 ? items : items.map(item => ({ ...item, value: 1 }));
  const size = compact ? 118 : 150;
  const center = compact ? 59 : 75;
  const radius = compact ? 42 : 58;
  const stroke = compact ? 14 : 18;
  let cursor = 0;
  const shellClass = !showLegend
    ? 'chart-donut chart-donut--solo'
    : legendPosition === 'bottom'
    ? 'chart-donut chart-donut--bottom'
    : 'chart-donut chart-donut--side';
  const layoutClass = !showLegend
    ? `chart-donut-layout chart-donut-layout--solo${compact ? ' is-compact' : ''}`
    : legendPosition === 'bottom'
    ? `chart-donut-layout chart-donut-layout--bottom${compact ? ' is-compact' : ''}`
    : `chart-donut-layout chart-donut-layout--side${compact ? ' is-compact' : ''}`;
  const svgClass = `chart-donut-surface${compact ? ' is-compact' : ''}`;

  if (!showLegend) {
    return (
      <div className={shellClass}>
        <div className={layoutClass}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={svgClass}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
            {normalized.map(item => {
              const pct = total > 0 ? item.value / total : 1 / Math.max(1, normalized.length);
              const dash = 2 * Math.PI * radius * pct;
              const offset = 2 * Math.PI * radius * cursor;
              cursor += pct;
              return (
                <circle
                  key={item.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${2 * Math.PI * radius - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${center} ${center})`}
                />
              );
            })}
            {showCenter && centerValue !== undefined && (
              <>
                <text x={center} y={center - 5} textAnchor="middle" fontSize={compact ? 9 : 10} fill="var(--muted)" fontWeight={600}>
                  {centerLabel}
                </text>
                <text x={center} y={center + 10} textAnchor="middle" fontSize={compact ? 11 : 13} fill="var(--text)" fontWeight={700}>
                  {centerValue}
                </text>
              </>
            )}
          </svg>
        </div>
      </div>
    );
  }

  if (legendPosition === 'bottom') {
    return (
      <div className={shellClass}>
        <div className={layoutClass}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={svgClass}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
            {normalized.map(item => {
              const pct = total > 0 ? item.value / total : 1 / Math.max(1, normalized.length);
              const dash = 2 * Math.PI * radius * pct;
              const offset = 2 * Math.PI * radius * cursor;
              cursor += pct;
              return (
                <circle
                  key={item.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${2 * Math.PI * radius - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${center} ${center})`}
                />
              );
            })}
            {showCenter && centerValue !== undefined && (
              <>
                <text x={center} y={center - 5} textAnchor="middle" fontSize={compact ? 9 : 10} fill="var(--muted)" fontWeight={600}>
                  {centerLabel}
                </text>
                <text x={center} y={center + 10} textAnchor="middle" fontSize={compact ? 11 : 13} fill="var(--text)" fontWeight={700}>
                  {centerValue}
                </text>
              </>
            )}
          </svg>

          <div className="chart-donut-legend chart-donut-legend--bottom">
            {items.map(item => {
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              const legendText = showPct ? `${pct.toFixed(0)}%` : valueFormatter(item.value);
              return (
                <div
                  key={item.label}
                  className={`chart-donut-legend-item chart-donut-legend-item--bottom${compact ? ' is-compact' : ''}`}
                >
                  <div className="chart-donut-dot" style={{ background: item.color }} />
                  <span className="chart-donut-label">
                    {item.label}
                  </span>
                  <span className="chart-donut-value">
                    {valueFormatter(item.value)}
                  </span>
                  <span className="chart-donut-pct">{legendText}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className={layoutClass}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={svgClass}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          {normalized.map(item => {
            const pct = total > 0 ? item.value / total : 1 / Math.max(1, normalized.length);
            const dash = 2 * Math.PI * radius * pct;
            const offset = 2 * Math.PI * radius * cursor;
            cursor += pct;
            return (
              <circle
                key={item.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${2 * Math.PI * radius - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />
            );
          })}
          {showCenter && centerValue !== undefined && (
            <>
              <text x={center} y={center - 5} textAnchor="middle" fontSize={compact ? 9 : 10} fill="var(--muted)" fontWeight={600}>
                {centerLabel}
              </text>
              <text x={center} y={center + 10} textAnchor="middle" fontSize={compact ? 11 : 13} fill="var(--text)" fontWeight={700}>
                {centerValue}
              </text>
            </>
          )}
        </svg>

        <div className="chart-donut-legend chart-donut-legend--side">
          {items.map(item => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div
                key={item.label}
                className={`chart-donut-legend-item chart-donut-legend-item--side${compact ? ' is-compact' : ''}`}
              >
                <div className="chart-donut-dot" style={{ background: item.color }} />
                <span className="chart-donut-label">
                  {item.label}
                </span>
                <div className="chart-donut-meta">
                  <span className="chart-donut-value">
                    {valueFormatter(item.value)}
                  </span>
                  {showPct && (
                    <span className="chart-donut-pct chart-donut-pct--side">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
