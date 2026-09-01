import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Link as LinkIcon,
  Copy,
  ExternalLink,
  QrCode,
  Code2,
  Plus,
  Edit2,
  Trash2,
  Check,
  Video,
  Clock,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { UserMeetingSettings, MeetingEventType } from '@/types/meeting';
import { EventTypeModal } from './EventTypeModal';

interface ShareBookingLinksProps {
  settings: UserMeetingSettings | null;
  companySlug: string;
  eventTypes: MeetingEventType[];
  onUpdateSettings: (updates: Partial<UserMeetingSettings>) => Promise<void>;
  onSaveEventType: (eventType: Partial<MeetingEventType>) => Promise<void>;
  onDeleteEventType: (id: string) => Promise<void>;
  isLoading: boolean;
}

export function ShareBookingLinks({
  settings,
  companySlug,
  eventTypes,
  onUpdateSettings,
  onSaveEventType,
  onDeleteEventType,
  isLoading,
}: ShareBookingLinksProps) {
  const [slugInput, setSlugInput] = useState(settings?.booking_slug || 'meet');
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  // Primary Meeting Editor Modal State
  const [isEditPrimaryModalOpen, setIsEditPrimaryModalOpen] = useState(false);
  const [primaryTitle, setPrimaryTitle] = useState(settings?.title || 'Interview');
  const [primaryDuration, setPrimaryDuration] = useState<number>(settings?.duration_minutes || 15);
  const [primaryDescription, setPrimaryDescription] = useState(settings?.description || '');
  const [primarySlug, setPrimarySlug] = useState(settings?.booking_slug || 'meet');
  const [isSavingPrimary, setIsSavingPrimary] = useState(false);

  useEffect(() => {
    if (settings) {
      setPrimaryTitle(settings.title || 'Interview');
      setPrimaryDuration(settings.duration_minutes || 15);
      setPrimaryDescription(settings.description || '');
      setPrimarySlug(settings.booking_slug || 'meet');
      setSlugInput(settings.booking_slug || 'meet');
    }
  }, [settings]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEventType, setEditingEventType] = useState<MeetingEventType | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fastesthr.com';
  const effectiveSlug = settings?.booking_slug || slugInput;
  const primaryBookingUrl = `${baseUrl}/${companySlug}/${effectiveSlug}`;

  const copyToClipboard = async (text: string, identifier: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(identifier);
      toast.success('📋 Booking link copied to clipboard!');
      setTimeout(() => setCopiedLink(null), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSaveSlug = async () => {
    const clean = slugInput
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (!clean) {
      toast.error('Booking slug cannot be empty');
      return;
    }

    try {
      setIsSavingSlug(true);
      await onUpdateSettings({ booking_slug: clean });
      setSlugInput(clean);
      setIsEditingSlug(false);
      toast.success(`🎉 Unique booking link updated to /${companySlug}/${clean}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update booking slug');
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleSavePrimaryDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = primarySlug
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    if (!cleanSlug) {
      toast.error('Booking slug cannot be empty');
      return;
    }

    try {
      setIsSavingPrimary(true);
      await onUpdateSettings({
        title: primaryTitle.trim() || '30 Min Meeting',
        duration_minutes: primaryDuration,
        description: primaryDescription.trim() || null,
        booking_slug: cleanSlug,
      });
      setSlugInput(cleanSlug);
      setIsEditPrimaryModalOpen(false);
      toast.success(`🎉 Meeting details updated! Duration set to ${primaryDuration} mins.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update meeting details');
    } finally {
      setIsSavingPrimary(false);
    }
  };

  const embedCode = `<iframe\n  src="${primaryBookingUrl}"\n  width="100%"\n  height="720px"\n  frameborder="0"\n  style="border: none; border-radius: 12px; overflow: hidden;"\n></iframe>`;

  return (
    <div className="space-y-6">
      {/* Primary Unique Booking Link Card */}
      <Card className="border-border/60 bg-gradient-to-br from-card via-card/70 to-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" />
                Your Unique Booking Link
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Share this link directly with clients, candidates, or add it to your email signature.
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1 hidden sm:flex">
              <Sparkles className="w-3 h-3" />
              Instant Booking Ready
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* URL Box & Action Buttons */}
          <div className="p-3.5 rounded-xl bg-card border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2 font-mono text-xs sm:text-sm overflow-x-auto py-1">
              <span className="text-muted-foreground select-none">{baseUrl}/{companySlug}/</span>
              {isEditingSlug ? (
                <Input
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="w-40 h-7 text-xs font-mono px-2 py-0 border-primary"
                  placeholder="custom-name"
                  autoFocus
                />
              ) : (
                <span className="font-bold text-primary px-1 py-0.5 rounded bg-primary/10">
                  {effectiveSlug}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isEditingSlug ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSaveSlug}
                    disabled={isSavingSlug || isLoading}
                    className="h-8 text-xs bg-primary"
                  >
                    {isSavingSlug ? 'Saving...' : 'Save Slug'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSlugInput(settings?.booking_slug || 'meet');
                      setIsEditingSlug(false);
                    }}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditPrimaryModalOpen(true)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-primary" />
                    Edit Title & Duration
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(primaryBookingUrl, 'primary')}
                    className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  >
                    {copiedLink === 'primary' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Link
                      </>
                    )}
                  </Button>

                  <a
                    href={primaryBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border border-border bg-background hover:bg-muted h-8 px-3 gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    Preview as Guest
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Meeting Config Summary (Title, Duration Badge, Description) */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-foreground text-sm">
                  {settings?.title || 'Interview'}
                </span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono py-0.5 px-2 gap-1 text-[11px]">
                  <Clock className="w-3 h-3" />
                  {settings?.duration_minutes || 15} mins
                </Badge>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 py-0.5 px-2 gap-1 text-[11px]">
                  <Video className="w-3 h-3" />
                  Google Meet
                </Badge>
              </div>
              {settings?.description && (
                <p className="text-muted-foreground text-xs line-clamp-1">
                  "{settings.description}"
                </p>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditPrimaryModalOpen(true)}
              className="h-8 text-xs gap-1.5 shrink-0 self-start sm:self-auto border-border/80"
            >
              <Edit2 className="w-3 h-3 text-primary" />
              Customize Duration ({settings?.duration_minutes || 30}m)
            </Button>
          </div>

          {/* Quick Share Tools: QR Code & Embed Snippet Toggles */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQR(!showQR)}
              className="h-8 text-xs gap-1.5 border-dashed"
            >
              <QrCode className="w-3.5 h-3.5 text-indigo-500" />
              {showQR ? 'Hide QR Code' : 'Generate QR Code'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmbed(!showEmbed)}
              className="h-8 text-xs gap-1.5 border-dashed"
            >
              <Code2 className="w-3.5 h-3.5 text-blue-500" />
              {showEmbed ? 'Hide Embed Code' : 'Embed on Website'}
            </Button>
          </div>

          {/* Collapsible QR Code Display */}
          {showQR && (
            <div className="p-4 rounded-xl bg-card border border-border/80 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(primaryBookingUrl)}`}
                  alt="Booking QR Code"
                  className="w-32 h-32"
                />
              </div>
              <div className="text-xs space-y-1.5 text-center sm:text-left">
                <h4 className="font-semibold text-foreground">Scan & Book from Mobile</h4>
                <p className="text-muted-foreground max-w-sm">
                  Display this QR code in your presentation slides, pitch decks, business cards, or office reception for instant smartphone bookings.
                </p>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(primaryBookingUrl)}`}
                  download="booking-qr.png"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block pt-1 text-primary hover:underline font-medium"
                >
                  Download High-Res QR Image →
                </a>
              </div>
            </div>
          )}

          {/* Collapsible Embed Code Display */}
          {showEmbed && (
            <div className="p-4 rounded-xl bg-card border border-border/80 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground">Embed Widget (iFrame)</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(embedCode, 'embed')}
                  className="h-7 text-xs gap-1"
                >
                  {copiedLink === 'embed' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  Copy HTML
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-muted font-mono text-[11px] overflow-x-auto text-foreground/80 leading-relaxed border border-border/40">
                {embedCode}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Types Section */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                Meeting Event Types
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                Offer tailored meeting durations and unique formats for interviews, sales demos, and 1-on-1s.
              </CardDescription>
            </div>

            <Button
              onClick={() => {
                setEditingEventType(null);
                setModalOpen(true);
              }}
              size="sm"
              className="gap-1.5 bg-primary text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              New Event Type
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {eventTypes.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-muted/20 border border-dashed border-border/80 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">No specialized event types created yet</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  By default, guests book using your primary 30-minute standard slot. You can add 15m, 45m, or 60m custom event types anytime.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingEventType(null);
                  setModalOpen(true);
                }}
                className="gap-1.5 text-xs h-8"
              >
                <Plus className="w-3.5 h-3.5" />
                Create 15m Coffee Chat / 45m Interview
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventTypes.map((et) => {
                const eventTypeUrl = `${primaryBookingUrl}?type=${et.slug}`;
                return (
                  <div
                    key={et.id}
                    className="p-4 rounded-xl bg-card border border-border/80 hover:border-primary/40 transition-all shadow-sm space-y-3 relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 bottom-0 w-1.5"
                      style={{ backgroundColor: et.color || '#6366f1' }}
                    />
                    <div className="flex items-start justify-between gap-3 pl-2">
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          {et.title}
                          <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5">
                            {et.duration_minutes}m
                          </Badge>
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {et.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingEventType(et);
                            setModalOpen(true);
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteEventType(et.id)}
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 pl-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Video className="w-3.5 h-3.5 text-blue-500" />
                        <span>Google Meet</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(eventTypeUrl, et.id)}
                          className="h-7 text-xs gap-1 px-2"
                        >
                          {copiedLink === et.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          Copy Link
                        </Button>
                        <a
                          href={eventTypeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 px-2 inline-flex items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal for adding/editing event type */}
      <EventTypeModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEventType(null);
        }}
        onSave={onSaveEventType}
        initialData={editingEventType}
        isLoading={isLoading}
      />

      {/* Primary Meeting Details & Duration Edit Dialog */}
      <Dialog open={isEditPrimaryModalOpen} onOpenChange={setIsEditPrimaryModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Settings2 className="w-5 h-5 text-primary" />
              Customize Default Meeting Link
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Configure the title, duration, welcome instructions, and custom URL handle for your primary booking link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePrimaryDetails} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Meeting Title</Label>
              <Input
                value={primaryTitle}
                onChange={(e) => setPrimaryTitle(e.target.value)}
                placeholder="e.g. 30 Min Meeting, Quick Intro Call"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Meeting Duration</Label>
              <Select
                value={primaryDuration.toString()}
                onValueChange={(val) => {
                  const num = parseInt(val, 10);
                  setPrimaryDuration(num);
                  if (primaryTitle.includes('Min Meeting') || primaryTitle.includes('Min')) {
                    setPrimaryTitle(`${num} Min Meeting`);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 Minutes (Quick catch-up)</SelectItem>
                  <SelectItem value="20">20 Minutes</SelectItem>
                  <SelectItem value="30">30 Minutes (Standard)</SelectItem>
                  <SelectItem value="45">45 Minutes (Screening / Consultation)</SelectItem>
                  <SelectItem value="60">60 Minutes (1 Hour Deep Dive)</SelectItem>
                  <SelectItem value="90">90 Minutes (Comprehensive)</SelectItem>
                  <SelectItem value="120">120 Minutes (2 Hours)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Custom URL Slug (Handle)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">/{companySlug}/</span>
                <Input
                  value={primarySlug}
                  onChange={(e) => setPrimarySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]+/g, '-'))}
                  placeholder="meet"
                  className="font-mono text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Welcome Description / Agenda (Optional)</Label>
              <Textarea
                value={primaryDescription}
                onChange={(e) => setPrimaryDescription(e.target.value)}
                placeholder="Welcome! Please select a convenient time on my calendar for our conversation."
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditPrimaryModalOpen(false)}
                disabled={isSavingPrimary}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingPrimary}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                {isSavingPrimary ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
