import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Save, X, Loader2 } from 'lucide-react';

interface ProfileSectionCardProps {
  title: string;
  icon: React.ReactNode;
  children: (editing: boolean) => React.ReactNode;
  onSave?: () => Promise<void>;
  editing?: boolean;
  onEditChange?: (editing: boolean) => void;
  className?: string;
  /** If true, the section is always in view mode (no edit button) */
  readOnly?: boolean;
}

export function ProfileSectionCard({
  title,
  icon,
  children,
  onSave,
  editing: controlledEditing,
  onEditChange,
  className = '',
  readOnly = false,
}: ProfileSectionCardProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const editing = controlledEditing !== undefined ? controlledEditing : internalEditing;
  const setEditing = onEditChange || setInternalEditing;

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
      setEditing(false);
    } catch {
      // Error handling done by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={`overflow-hidden border-border/40 shadow-sm transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 ${className}`}>
      <CardHeader className="border-b border-border/10 bg-muted/20 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground font-medium text-base flex items-center gap-2.5">
            {icon}
            {title}
          </CardTitle>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {!editing ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="h-8 px-3 text-xs font-medium border-border/50 hover:border-primary hover:bg-primary/10 hover:text-primary transition-all rounded-full"
                >
                  <Pencil className="h-3 w-3 mr-1.5" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="h-8 px-4 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-sm transition-all"
                  >
                    {saving ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    ) : (
                      <Save className="h-3 w-3 mr-1.5" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="h-8 px-3 text-xs font-medium rounded-full"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6 pb-8">
        {children(editing)}
      </CardContent>
    </Card>
  );
}
