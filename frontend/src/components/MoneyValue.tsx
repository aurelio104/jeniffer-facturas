import { fmtBs } from '../services/api';

type Props = {
  value: number | null | undefined;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSign?: boolean;
  invertColors?: boolean;
};

export function MoneyValue({
  value,
  className = '',
  size = 'md',
  showSign = false,
  invertColors = false
}: Props) {
  if (value == null || Number.isNaN(value)) {
    return <span className={`num-value num-neutral num-${size} ${className}`}>—</span>;
  }

  let tone: 'positive' | 'negative' | 'neutral' =
    value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';

  if (invertColors && tone !== 'neutral') {
    tone = tone === 'positive' ? 'negative' : 'positive';
  }

  const prefix = showSign && value > 0 ? '+' : '';
  const cls =
    tone === 'positive' ? 'num-positive' : tone === 'negative' ? 'num-negative' : 'num-neutral';

  return (
    <span className={`num-value ${cls} num-${size} ${className}`}>
      {prefix}{fmtBs(value)}
    </span>
  );
}
