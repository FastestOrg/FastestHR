import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  disabled?: boolean;
  label?: string;
}

export function StarRating({
  value,
  onChange,
  max = 5,
  disabled = false,
  label,
}: StarRatingProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(star === value ? 0 : star)}
            className={`transition-all duration-150 ${
              disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            }`}
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= value
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-none text-border/60 hover:text-amber-300'
              }`}
            />
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-2 tabular-nums">
          {value}/{max}
        </span>
      </div>
    </div>
  );
}
