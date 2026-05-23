import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface RepeatableFieldGroupProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, update: (field: keyof T, value: any) => void) => React.ReactNode;
  createEmpty: () => T;
  label: string;
  maxItems?: number;
  disabled?: boolean;
}

export function RepeatableFieldGroup<T extends Record<string, any>>({
  items,
  onChange,
  renderItem,
  createEmpty,
  label,
  maxItems = 10,
  disabled = false,
}: RepeatableFieldGroupProps<T>) {
  const addItem = () => {
    if (items.length >= maxItems) return;
    onChange([...items, createEmpty()]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof T, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="relative rounded-xl border border-border/30 bg-muted/5 p-5 transition-all hover:border-border/50 group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {label} {items.length > 1 ? index + 1 : ''}
            </span>
            {!disabled && items.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {renderItem(item, index, (field, value) => updateItem(index, field, value))}
        </div>
      ))}
      {!disabled && items.length < maxItems && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="w-full border-dashed border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all h-10 rounded-xl"
        >
          <Plus className="h-3.5 w-3.5 mr-2" />
          Add {label}
        </Button>
      )}
    </div>
  );
}
