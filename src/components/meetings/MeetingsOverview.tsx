import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  User,
  Mail,
  Phone,
  Linkedin,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Download,
  MoreVertical,
  Trash2,
  Copy,
  CalendarCheck,
  CalendarX,
  History,
  Radio,
} from 'lucide-react';
import { MeetingBooking } from '@/types/meeting';
import {
  generateICSContent,
  generateGoogleCalendarWebUrl,
  generateOutlookWebUrl,
  deleteGoogleCalendarMeetingEvent,
} from '@/lib/google-calendar';

interface MeetingsOverviewProps {
  bookings: MeetingBooking[];
  isLoading: boolean;
  onCancelBooking: (bookingId: string, reason?: string) => Promise<void>;
  gcalAccessToken?: string | null;
  onNavigateToShare: () => void;
}

export function MeetingsOverview({
  bookings,
  isLoading,
  onCancelBooking,
  gcalAccessToken,
  onNavigateToShare,
}: MeetingsOverviewProps) {
  const [filterTab, setFilterTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<MeetingBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const now = new Date();

  // Metrics
  const upcomingCount = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed' && new Date(b.end_time) >= now).length,
    [bookings, now]
  );
  const todayCount = useMemo(() => {
    const todayStr = now.toISOString().split('T')[0];
    return bookings.filter(
      (b) => b.status === 'confirmed' && b.start_time.startsWith(todayStr)
    ).length;
  }, [bookings, now]);
  const completedCount = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed' && new Date(b.end_time) < now).length,
    [bookings, now]
  );

  // Filtered List
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        // Tab Filter
        if (filterTab === 'upcoming') {
          return b.status === 'confirmed' && new Date(b.end_time) >= now;
        }
        if (filterTab === 'past') {
          return b.status === 'confirmed' && new Date(b.end_time) < now;
        }
        if (filterTab === 'cancelled') {
          return b.status === 'cancelled';
        }
        return true;
      })
      .filter((b) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          b.guest_name.toLowerCase().includes(q) ||
          b.guest_email.toLowerCase().includes(q) ||
          b.guest_phone.toLowerCase().includes(q) ||
          (b.notes && b.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (filterTab === 'past') {
          return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
        }
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      });
  }, [bookings, filterTab, searchQuery, now]);

  const handleDownloadICS = (b: MeetingBooking) => {
    const icsString = generateICSContent({
      title: `Meeting with ${b.guest_name}`,
      description: b.notes || '',
      location: b.meeting_link || 'Google Meet',
      startISO: b.start_time,
      endISO: b.end_time,
      guestName: b.guest_name,
      guestEmail: b.guest_email,
    });

    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `meeting-${b.guest_name.toLowerCase().replace(/\s+/g, '-')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('📅 .ICS Calendar file downloaded');
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    try {
      setIsCancelling(true);

      // If synced with Google Calendar, delete event from GCal
      if (cancellingBooking.google_event_id && gcalAccessToken) {
        await deleteGoogleCalendarMeetingEvent(gcalAccessToken, cancellingBooking.google_event_id);
      }

      await onCancelBooking(cancellingBooking.id, cancelReason);
      toast.success('Meeting cancelled successfully.');
      setCancellingBooking(null);
      setCancelReason('');
    } catch (err: any) {
      toast.error('Failed to cancel meeting: ' + err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{upcomingCount}</div>
              <div className="text-xs text-muted-foreground font-medium">Upcoming Bookings</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{todayCount}</div>
              <div className="text-xs text-muted-foreground font-medium">Scheduled for Today</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{completedCount}</div>
              <div className="text-xs text-muted-foreground font-medium">Completed Meetings</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main List Section with Search & Tabs */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Scheduled Meetings
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                Manage your confirmed bookings, jump directly into video calls, or export calendar events.
              </CardDescription>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attendee, email, phone..."
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Segmented Filter Tabs */}
          <div className="pt-2">
            <Tabs
              value={filterTab}
              onValueChange={(val) => setFilterTab(val as any)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 w-full sm:w-80 h-9 p-1">
                <TabsTrigger value="upcoming" className="text-xs">
                  Upcoming ({upcomingCount})
                </TabsTrigger>
                <TabsTrigger value="past" className="text-xs">
                  Past ({completedCount})
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="text-xs">
                  Cancelled
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="pt-2 space-y-4">
          {isLoading ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-10 text-center rounded-xl bg-muted/20 border border-dashed border-border/80 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">No {filterTab} meetings found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {filterTab === 'upcoming'
                    ? 'Your upcoming appointments will appear here as soon as guests book via your unique link.'
                    : `No ${filterTab} appointments match your query.`}
                </p>
              </div>
              {filterTab === 'upcoming' && (
                <Button size="sm" onClick={onNavigateToShare} className="gap-1.5 text-xs h-8 bg-primary">
                  <Copy className="w-3 h-3" />
                  Get Shareable Link
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => {
                const startDate = new Date(booking.start_time);
                const endDate = new Date(booking.end_time);

                const dateDisplay = startDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const startTimeDisplay = startDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });
                const endTimeDisplay = endDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });

                const isLiveNow = now >= startDate && now <= endDate && booking.status === 'confirmed';

                return (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isLiveNow
                        ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
                        : 'bg-card border-border/80 hover:border-border shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Timing & Guest Summary */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {/* Date badge */}
                        <div className="w-16 h-16 rounded-xl bg-muted/60 border border-border/80 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            {startDate.toLocaleDateString(undefined, { month: 'short' })}
                          </span>
                          <span className="text-xl font-black text-foreground">
                            {startDate.getDate()}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground">
                              {booking.guest_name}
                            </h4>
                            {isLiveNow && (
                              <Badge className="bg-emerald-500 text-white text-[10px] gap-1 animate-pulse">
                                <Radio className="w-2.5 h-2.5" /> Happening Now
                              </Badge>
                            )}
                            {booking.status === 'cancelled' && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">
                                Cancelled
                              </Badge>
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="flex items-center gap-1 font-medium text-foreground/90">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              {dateDisplay} • {startTimeDisplay} – {endTimeDisplay}
                            </span>
                            <span>({booking.timezone})</span>
                          </div>

                          {/* Contact badges: Email, Phone, LinkedIn */}
                          <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                            <a
                              href={`mailto:${booking.guest_email}`}
                              className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              {booking.guest_email}
                            </a>

                            <a
                              href={`tel:${booking.guest_phone}`}
                              className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {booking.guest_phone}
                            </a>

                            {booking.guest_linkedin && (
                              <a
                                href={
                                  booking.guest_linkedin.startsWith('http')
                                    ? booking.guest_linkedin
                                    : `https://${booking.guest_linkedin}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors"
                              >
                                <Linkedin className="w-3 h-3" />
                                LinkedIn Profile
                              </a>
                            )}
                          </div>

                          {/* Notes if provided */}
                          {booking.notes && (
                            <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded-lg mt-1.5 border border-border/40 max-w-xl">
                              "{booking.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 shrink-0">
                        {/* Join Meeting Link */}
                        {booking.meeting_link && booking.status === 'confirmed' && (
                          <a
                            href={booking.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-lg text-xs font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white h-9 px-3.5 gap-2 shadow-sm"
                          >
                            <Video className="w-4 h-4" />
                            Join Google Meet
                          </a>
                        )}

                        {/* Export ICS */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadICS(booking)}
                          className="h-9 text-xs gap-1.5"
                          title="Download .ICS for Apple/Outlook calendar"
                        >
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          .ICS
                        </Button>

                        {/* Google Calendar Web URL */}
                        <a
                          href={generateGoogleCalendarWebUrl({
                            title: `Meeting with ${booking.guest_name}`,
                            description: booking.notes || '',
                            location: booking.meeting_link || 'Google Meet',
                            startISO: booking.start_time,
                            endISO: booking.end_time,
                          })}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-lg text-xs font-medium transition-colors border border-border bg-card hover:bg-muted h-9 px-2.5"
                          title="Open in Google Calendar"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>

                        {/* Cancel Meeting */}
                        {booking.status === 'confirmed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCancellingBooking(booking);
                              setCancelReason('');
                            }}
                            className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancellingBooking} onOpenChange={() => setCancellingBooking(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Cancel Scheduled Meeting
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to cancel the meeting with{' '}
              <strong>{cancellingBooking?.guest_name}</strong>? This slot will be released and the Google Calendar event removed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-medium">Reason for Cancellation (Optional)</label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Schedule conflict, rescheduled via email..."
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancellingBooking(null)}
              disabled={isCancelling}
            >
              Keep Meeting
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="gap-1.5"
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
