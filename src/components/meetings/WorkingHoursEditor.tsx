import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Clock,
  Calendar,
  Globe,
  Plus,
  Trash2,
  Copy,
  Save,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  DayOfWeek,
  WeeklySchedule,
  UserMeetingSettings,
  DEFAULT_WEEKLY_SCHEDULE,
} from '@/types/meeting';

interface WorkingHoursEditorProps {
  settings: UserMeetingSettings | null;
  onSaveSettings: (updates: Partial<UserMeetingSettings>) => Promise<void>;
  isLoading: boolean;
}

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'mon', label: 'Monday', short: 'Mon' },
  { key: 'tue', label: 'Tuesday', short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday', short: 'Thu' },
  { key: 'fri', label: 'Friday', short: 'Fri' },
  { key: 'sat', label: 'Saturday', short: 'Sat' },
  { key: 'sun', label: 'Sunday', short: 'Sun' },
];

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const PRESET_FUTURE_DAYS = [7, 14, 30, 60, 90];

export function WorkingHoursEditor({
  settings,
  onSaveSettings,
  isLoading,
}: WorkingHoursEditorProps) {
  const [schedule, setSchedule] = useState<WeeklySchedule>(
    settings?.weekly_schedule || DEFAULT_WEEKLY_SCHEDULE
  );
  const [duration, setDuration] = useState<number>(settings?.duration_minutes ?? 15);
  const [timezone, setTimezone] = useState<string>(
    settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [bufferBefore, setBufferBefore] = useState<number>(settings?.buffer_before_minutes ?? 0);
  const [bufferAfter, setBufferAfter] = useState<number>(settings?.buffer_after_minutes ?? 0);
  const [minNotice, setMinNotice] = useState<number>(settings?.min_notice_hours ?? 2);
  const [maxFutureDays, setMaxFutureDays] = useState<number>(settings?.max_future_days ?? 7);
  const [isCustomDays, setIsCustomDays] = useState<boolean>(() => {
    const initial = settings?.max_future_days ?? 7;
    return !PRESET_FUTURE_DAYS.includes(initial);
  });
  const [customDaysInput, setCustomDaysInput] = useState<string>(() => {
    return String(settings?.max_future_days ?? 7);
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      if (settings.weekly_schedule) setSchedule(settings.weekly_schedule);
      if (settings.duration_minutes) setDuration(settings.duration_minutes);
      if (settings.timezone) setTimezone(settings.timezone);
      if (settings.buffer_before_minutes !== undefined) setBufferBefore(settings.buffer_before_minutes);
      if (settings.buffer_after_minutes !== undefined) setBufferAfter(settings.buffer_after_minutes);
      if (settings.min_notice_hours !== undefined) setMinNotice(settings.min_notice_hours);
      if (settings.max_future_days !== undefined) {
        setMaxFutureDays(settings.max_future_days);
        setCustomDaysInput(String(settings.max_future_days));
        setIsCustomDays(!PRESET_FUTURE_DAYS.includes(settings.max_future_days));
      }
    }
  }, [settings]);

  const toggleDay = (day: DayOfWeek, enabled: boolean) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled,
        slots: prev[day]?.slots?.length
          ? prev[day].slots
          : [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }],
      },
    }));
  };

  const updateSlot = (day: DayOfWeek, index: number, field: 'start' | 'end', value: string) => {
    setSchedule((prev) => {
      const currentSlots = [...(prev[day]?.slots || [])];
      if (currentSlots[index]) {
        currentSlots[index] = {
          ...currentSlots[index],
          [field]: value,
        };
      }
      return {
        ...prev,
        [day]: {
          ...prev[day],
          slots: currentSlots,
        },
      };
    });
  };

  const addSlot = (day: DayOfWeek) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [...(prev[day]?.slots || []), { start: '15:00', end: '19:00' }],
      },
    }));
  };

  const removeSlot = (day: DayOfWeek, index: number) => {
    setSchedule((prev) => {
      const currentSlots = [...(prev[day]?.slots || [])];
      currentSlots.splice(index, 1);
      return {
        ...prev,
        [day]: {
          ...prev[day],
          slots: currentSlots.length > 0
            ? currentSlots
            : [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }],
          enabled: currentSlots.length > 0,
        },
      };
    });
  };

  const copyToAllWeekdays = (sourceDay: DayOfWeek) => {
    const sourceSchedule = schedule[sourceDay];
    if (!sourceSchedule) return;

    setSchedule((prev) => ({
      ...prev,
      mon: JSON.parse(JSON.stringify(sourceSchedule)),
      tue: JSON.parse(JSON.stringify(sourceSchedule)),
      wed: JSON.parse(JSON.stringify(sourceSchedule)),
      thu: JSON.parse(JSON.stringify(sourceSchedule)),
      fri: JSON.parse(JSON.stringify(sourceSchedule)),
      sat: JSON.parse(JSON.stringify(sourceSchedule)),
    }));
    toast.success(`Copied ${sourceDay.toUpperCase()} schedule to Mon–Sat.`);
  };

  const resetToDefaultHours = () => {
    setSchedule(DEFAULT_WEEKLY_SCHEDULE);
    toast.success('Reset to default hours: Mon–Sat 10:00 AM – 2:00 PM & 3:00 PM – 7:00 PM.');
  };

  const handleMaxDaysSelect = (val: string) => {
    if (val === 'custom') {
      setIsCustomDays(true);
      const current = maxFutureDays > 0 ? maxFutureDays : 7;
      setCustomDaysInput(String(current));
      setMaxFutureDays(current);
    } else {
      setIsCustomDays(false);
      const parsed = Number(val);
      setMaxFutureDays(parsed);
      setCustomDaysInput(String(parsed));
    }
  };

  const handleCustomDaysChange = (val: string) => {
    setCustomDaysInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setMaxFutureDays(parsed);
    }
  };

  const handleCustomDaysBlur = () => {
    const parsed = parseInt(customDaysInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      setMaxFutureDays(1);
      setCustomDaysInput('1');
    } else if (parsed > 365) {
      setMaxFutureDays(365);
      setCustomDaysInput('365');
      toast.info('Maximum future booking window is 365 days.');
    } else {
      setMaxFutureDays(parsed);
      setCustomDaysInput(String(parsed));
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      let resolvedMaxFutureDays = maxFutureDays;
      if (isCustomDays) {
        const parsed = parseInt(customDaysInput, 10);
        if (isNaN(parsed) || parsed < 1) {
          toast.error('Please enter a valid custom future range (at least 1 day).');
          setIsSaving(false);
          return;
        }
        if (parsed > 365) {
          toast.error('Custom future range cannot exceed 365 days (1 year).');
          setIsSaving(false);
          return;
        }
        resolvedMaxFutureDays = parsed;
        setMaxFutureDays(parsed);
        setCustomDaysInput(String(parsed));
      }

      await onSaveSettings({
        weekly_schedule: schedule,
        duration_minutes: duration,
        timezone,
        buffer_before_minutes: bufferBefore,
        buffer_after_minutes: bufferAfter,
        min_notice_hours: minNotice,
        max_future_days: resolvedMaxFutureDays,
      });
      toast.success('🎉 Availability and working hours saved successfully!');
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Weekly Schedule Card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Weekly Working Hours
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                Define the days and time windows when you are open for meetings.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefaultHours}
                disabled={isSaving || isLoading}
                className="gap-1.5 text-xs h-9"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Default (Mon-Sat)
              </Button>

              <Button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm h-9"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Availability'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {DAYS.map(({ key, label }) => {
            const dayData = schedule[key] || { enabled: false, slots: [] };
            const isEnabled = dayData.enabled;

            return (
              <div
                key={key}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                  isEnabled
                    ? 'bg-card border-border/80 shadow-sm'
                    : 'bg-muted/20 border-border/40 opacity-70'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Day Toggle */}
                  <div className="flex items-center gap-3 w-40 shrink-0">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => toggleDay(key, checked)}
                    />
                    <span className={`text-sm font-semibold ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {label}
                    </span>
                  </div>

                  {/* Slots List or Unavailable Label */}
                  {isEnabled ? (
                    <div className="flex-1 space-y-2">
                      {dayData.slots?.map((slot, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateSlot(key, idx, 'start', e.target.value)}
                            className="w-32 h-8 text-xs font-mono bg-background"
                          />
                          <span className="text-muted-foreground text-xs font-medium">to</span>
                          <Input
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateSlot(key, idx, 'end', e.target.value)}
                            className="w-32 h-8 text-xs font-mono bg-background"
                          />

                          {dayData.slots.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSlot(key, idx)}
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 text-xs text-muted-foreground italic">
                      Unavailable on {label}s
                    </div>
                  )}

                  {/* Actions (Add interval & Copy) */}
                  {isEnabled && (
                    <div className="flex items-center gap-1.5 shrink-0 pt-2 md:pt-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addSlot(key)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                        title="Add second interval"
                      >
                        <Plus className="w-3 h-3" />
                        Interval
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToAllWeekdays(key)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                        title="Copy this day to Mon-Fri"
                      >
                        <Copy className="w-3 h-3" />
                        Copy to Weekdays
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Rules, Buffers & Timezone Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Meeting Rules & Buffers */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Buffer & Scheduling Rules
            </CardTitle>
            <CardDescription className="text-xs">
              Prevent back-to-back fatigue and control how far in advance guests can book.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Default Duration */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Meeting Duration</Label>
              <Select
                value={String(duration)}
                onValueChange={(val) => setDuration(Number(val))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes (Quick Sync)</SelectItem>
                  <SelectItem value="30">30 minutes (Standard)</SelectItem>
                  <SelectItem value="45">45 minutes (Detailed)</SelectItem>
                  <SelectItem value="60">60 minutes (Deep Dive)</SelectItem>
                  <SelectItem value="90">90 minutes (Workshop)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Buffer After Meeting */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Buffer Before</Label>
                <Select
                  value={String(bufferBefore)}
                  onValueChange={(val) => setBufferBefore(Number(val))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 minutes</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Buffer After</Label>
                <Select
                  value={String(bufferAfter)}
                  onValueChange={(val) => setBufferAfter(Number(val))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 minutes</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notice Period & Booking Horizon */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Minimum Notice</Label>
                <Select
                  value={String(minNotice)}
                  onValueChange={(val) => setMinNotice(Number(val))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Immediately</SelectItem>
                    <SelectItem value="1">1 hour before</SelectItem>
                    <SelectItem value="2">2 hours before</SelectItem>
                    <SelectItem value="4">4 hours before</SelectItem>
                    <SelectItem value="24">24 hours before</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Max Future Range</Label>
                <Select
                  value={isCustomDays ? 'custom' : String(maxFutureDays)}
                  onValueChange={handleMaxDaysSelect}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days into future</SelectItem>
                    <SelectItem value="14">14 days into future</SelectItem>
                    <SelectItem value="30">30 days into future</SelectItem>
                    <SelectItem value="60">60 days into future</SelectItem>
                    <SelectItem value="90">90 days into future</SelectItem>
                    <SelectItem value="custom">
                      {isCustomDays ? `Custom (${maxFutureDays || customDaysInput || 1} days)` : 'Custom days...'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Future Range Input */}
            {isCustomDays && (
              <div className="p-3 bg-muted/40 border border-border/70 rounded-lg space-y-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom-future-range-input" className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    Custom Booking Window
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-medium">1 – 365 days</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="custom-future-range-input"
                      type="number"
                      min={1}
                      max={365}
                      value={customDaysInput}
                      onChange={(e) => handleCustomDaysChange(e.target.value)}
                      onBlur={handleCustomDaysBlur}
                      placeholder="e.g. 45"
                      className="h-9 text-xs pr-14 font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                      days
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleMaxDaysSelect('7')}
                    className="h-9 text-xs px-2.5 text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset to 7-day standard"
                  >
                    Reset
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Guests can book slots up to <strong className="text-foreground font-semibold">{maxFutureDays || customDaysInput || 1} days</strong> ahead from today.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timezone & Localization Card */}
        <Card className="border-border/60 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                Timezone & Localization
              </CardTitle>
              <CardDescription className="text-xs">
                Your slots will automatically convert to your guest's local timezone on their booking page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Host Primary Timezone</Label>
                <Select value={timezone} onValueChange={(val) => setTimezone(val)}>
                  <SelectTrigger className="h-9 font-mono text-xs">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz} className="font-mono text-xs">
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/30 border border-border/50 text-xs space-y-1 text-muted-foreground">
                <p className="font-semibold text-foreground">💡 Smart Timezone Conversion</p>
                <p>
                  When a candidate or client opens your booking link from London or Tokyo, FastestHR automatically detects their browser timezone and displays all available slots in their local time.
                </p>
              </div>
            </CardContent>
          </div>

          <div className="p-4 border-t border-border/40 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Apply & Save Settings'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
