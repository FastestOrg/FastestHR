import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MeetingEventType, LocationType } from '@/types/meeting';

interface EventTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventType: Partial<MeetingEventType>) => Promise<void>;
  initialData?: MeetingEventType | null;
  isLoading?: boolean;
}

const COLOR_OPTIONS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#14b8a6', // Teal
  '#ef4444', // Red
];

export function EventTypeModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  isLoading,
}: EventTypeModalProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [locationType, setLocationType] = useState<LocationType>('google_meet');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setSlug(initialData.slug);
      setDescription(initialData.description || '');
      setDuration(initialData.duration_minutes);
      setLocationType(initialData.location_type);
      setColor(initialData.color || '#6366f1');
    } else {
      setTitle('');
      setSlug('');
      setDescription('');
      setDuration(30);
      setLocationType('google_meet');
      setColor('#6366f1');
    }
  }, [initialData, isOpen]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!initialData) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlug(generatedSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;

    await onSave({
      ...(initialData?.id ? { id: initialData.id } : {}),
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim() || null,
      duration_minutes: duration,
      location_type: locationType,
      color,
      is_active: true,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {initialData ? 'Edit Event Type' : 'Create New Event Type'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Set up custom meeting formats with tailored durations, locations, and descriptions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Event Title *</Label>
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. 45 Min Technical Interview"
              required
              className="h-9"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Event URL Handle *</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">/</span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="tech-screen"
                required
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          {/* Duration & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Duration</Label>
              <Select value={String(duration)} onValueChange={(val) => setDuration(Number(val))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 mins</SelectItem>
                  <SelectItem value="30">30 mins</SelectItem>
                  <SelectItem value="45">45 mins</SelectItem>
                  <SelectItem value="60">60 mins</SelectItem>
                  <SelectItem value="90">90 mins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Location</Label>
              <Select value={locationType} onValueChange={(val: LocationType) => setLocationType(val)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google_meet">Google Meet (Auto)</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="in_person">In-Person Meeting</SelectItem>
                  <SelectItem value="custom">Custom Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color Tag */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Accent Color</Label>
            <div className="flex items-center gap-2 pt-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description / Instructions</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide agenda or pre-meeting instructions for the guest..."
              rows={3}
              className="resize-none text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5 bg-primary">
              {initialData ? 'Save Changes' : 'Create Event Type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
