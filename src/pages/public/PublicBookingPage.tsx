import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getCompanySlugFromHost } from '@/utils/tenantUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  User,
  Mail,
  Phone,
  Linkedin,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  ArrowRight,
  Sparkles,
  Building2,
  Download,
  ExternalLink,
  ShieldCheck,
  CalendarCheck,
} from 'lucide-react';
import {
  PublicBookingPageData,
  MeetingEventType,
  SlotOption,
  DEFAULT_WEEKLY_SCHEDULE,
} from '@/types/meeting';
import {
  calculateAvailableSlots,
  generateICSContent,
  generateGoogleCalendarWebUrl,
  generateOutlookWebUrl,
  createGoogleCalendarMeetingEvent,
  fetchGoogleCalendarBusyRanges,
} from '@/lib/google-calendar';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PublicBookingPage() {
  const { companySlug: routeCompanySlug, bookingSlug } = useParams<{ companySlug: string; bookingSlug: string }>();
  const companySlug = routeCompanySlug || getCompanySlugFromHost();
  const [searchParams] = useSearchParams();
  const requestedTypeSlug = searchParams.get('type');

  const [pageData, setPageData] = useState<PublicBookingPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEventType, setSelectedEventType] = useState<MeetingEventType | null>(null);
  const [googleBusyRanges, setGoogleBusyRanges] = useState<{ start: string; end: string }[]>([]);

  // Calendar State
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);

  // Guest Timezone
  const [guestTimezone, setGuestTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );

  // Step 2: Form State
  const [step, setStep] = useState<'pick_time' | 'guest_form' | 'confirmed'>('pick_time');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestLinkedin, setGuestLinkedin] = useState('');
  const [guestNotes, setGuestNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmed Result
  const [confirmedBooking, setConfirmedBooking] = useState<{
    bookingId: string;
    startTime: string;
    endTime: string;
    meetingLink: string;
    hostName: string;
    companyName: string;
  } | null>(null);

  // 1. Fetch public booking data from RPC
  useEffect(() => {
    async function loadBookingPage() {
      if (!companySlug || !bookingSlug) return;
      try {
        setIsLoading(true);
        const { data, error } = await supabase.rpc('get_public_booking_page', {
          p_company_slug: companySlug,
          p_booking_slug: bookingSlug,
        });

        if (error) {
          console.error('Error fetching public booking page:', error);
          setPageData({ success: false, error: error.message });
          return;
        }

        const result = data as PublicBookingPageData;
        setPageData(result);

        if (result.success && result.event_types && result.event_types.length > 0) {
          if (requestedTypeSlug) {
            const matched = result.event_types.find((et) => et.slug === requestedTypeSlug);
            if (matched) setSelectedEventType(matched);
          }
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setPageData({ success: false, error: err.message });
      } finally {
        setIsLoading(false);
      }
    }

    loadBookingPage();
  }, [companySlug, bookingSlug, requestedTypeSlug]);

  // 2. Fetch real-time live events from host's connected Google Calendar
  useEffect(() => {
    async function syncLiveGoogleCalendar() {
      const accessToken = pageData?.settings?.google_access_token;
      if (!pageData?.settings?.google_calendar_connected || !accessToken) {
        setGoogleBusyRanges([]);
        return;
      }

      try {
        const timeMin = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString();
        const timeMax = new Date(viewDate.getFullYear(), viewDate.getMonth() + 2, 28).toISOString();

        const liveBusy = await fetchGoogleCalendarBusyRanges(accessToken, timeMin, timeMax);
        if (liveBusy && liveBusy.length > 0) {
          setGoogleBusyRanges(liveBusy);
        }
      } catch (err) {
        console.warn('Real-time Google Calendar sync notice:', err);
      }
    }

    if (pageData?.success) {
      syncLiveGoogleCalendar();
    }
  }, [pageData, viewDate]);

  // Set initial selected date to today or tomorrow
  useEffect(() => {
    if (!selectedDate && pageData?.success) {
      const initialDate = new Date();
      setSelectedDate(initialDate);
    }
  }, [pageData, selectedDate]);

  // Effective Duration & Title
  const effectiveDuration = selectedEventType
    ? selectedEventType.duration_minutes
    : (pageData?.settings?.duration_minutes || 15);

  const effectiveTitle = selectedEventType
    ? selectedEventType.title
    : (pageData?.settings?.title || 'Interview');

  const effectiveDescription = selectedEventType?.description || pageData?.settings?.description || '';

  // Calculate available slots for selected date (combining DB bookings + live Google Calendar)
  const availableSlots: SlotOption[] = useMemo(() => {
    if (!selectedDate || !pageData?.settings) return [];

    const schedule = pageData.settings.weekly_schedule || DEFAULT_WEEKLY_SCHEDULE;
    const dbBusy = (pageData.busy_slots || []).map((b) => ({
      start: b.start_time,
      end: b.end_time,
    }));

    const combinedBusy = [...dbBusy, ...googleBusyRanges];

    return calculateAvailableSlots({
      date: selectedDate,
      weeklySchedule: schedule,
      durationMinutes: effectiveDuration,
      bufferBeforeMinutes: pageData.settings.buffer_before_minutes ?? 0,
      bufferAfterMinutes: pageData.settings.buffer_after_minutes ?? 0,
      minNoticeHours: pageData.settings.min_notice_hours ?? 2,
      hostTimezone: pageData.settings.timezone || 'UTC',
      busyIntervals: combinedBusy,
    });
  }, [selectedDate, pageData, effectiveDuration, googleBusyRanges]);

  // Handle month navigation
  const prevMonth = () => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    const now = new Date();
    if (d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth())) {
      return;
    }
    setViewDate(d);
  };

  const nextMonth = () => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    setViewDate(d);
  };

  // Build calendar matrix
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; isPast: boolean; isAvailable: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDays = pageData?.settings?.max_future_days || 7;
    const maxFutureDate = new Date();
    maxFutureDate.setDate(maxFutureDate.getDate() + maxDays);

    // Padding before first day of month
    for (let i = 0; i < firstDayIndex; i++) {
      const prevDate = new Date(year, month, -(firstDayIndex - 1 - i));
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isPast: true,
        isAvailable: false,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const isPast = dateObj.getTime() < today.getTime();
      const isTooFar = dateObj.getTime() > maxFutureDate.getTime();

      // Check if day enabled in host schedule
      const dayKeyMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
      const dayKey = dayKeyMap[dateObj.getDay()];
      const isDayEnabled = pageData?.settings?.weekly_schedule?.[dayKey]?.enabled ?? true;

      const isAvailable = !isPast && !isTooFar && isDayEnabled;

      days.push({
        date: dateObj,
        isCurrentMonth: true,
        isPast,
        isAvailable,
      });
    }

    return days;
  }, [viewDate, pageData]);

  // Submit Booking Form
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim() || !selectedSlot) {
      toast.error('Please complete all required fields');
      return;
    }

    try {
      setIsSubmitting(true);

      let googleMeetLink: string | null = null;
      let googleEventId: string | null = null;

      // 1. If host has Google Calendar connected, create real Google Calendar Event & obtain real Google Meet Link
      if (pageData?.settings?.google_calendar_connected && pageData?.settings?.google_access_token) {
        try {
          const gcalResult = await createGoogleCalendarMeetingEvent({
            accessToken: pageData.settings.google_access_token,
            title: `${effectiveTitle} with ${guestName.trim()}`,
            description: guestNotes.trim(),
            guestName: guestName.trim(),
            guestEmail: guestEmail.trim().toLowerCase(),
            guestPhone: guestPhone.trim(),
            guestLinkedin: guestLinkedin.trim(),
            startISO: selectedSlot.startISO,
            endISO: selectedSlot.endISO,
            timezone: guestTimezone,
            autoGoogleMeet: pageData.settings.auto_google_meet ?? true,
          });

          if (gcalResult) {
            googleMeetLink = gcalResult.meetingLink || null;
            googleEventId = gcalResult.eventId || null;
          }
        } catch (gcalErr: any) {
          console.warn('Google Calendar event provisioning notice:', gcalErr);
        }
      }

      // 2. Persist booking record in Database with the exact Google Calendar event and Google Meet link
      const { data, error } = await supabase.rpc('create_public_booking', {
        p_company_slug: companySlug!,
        p_booking_slug: bookingSlug!,
        p_event_type_id: selectedEventType?.id || null,
        p_guest_name: guestName.trim(),
        p_guest_email: guestEmail.trim().toLowerCase(),
        p_guest_phone: guestPhone.trim(),
        p_guest_linkedin: guestLinkedin.trim() || null,
        p_notes: guestNotes.trim() || null,
        p_start_time: selectedSlot.startISO,
        p_end_time: selectedSlot.endISO,
        p_guest_timezone: guestTimezone,
        p_meeting_link: googleMeetLink,
        p_google_event_id: googleEventId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = data as any;
      if (!result.success) {
        throw new Error(result.error || 'Booking failed');
      }

      setConfirmedBooking({
        bookingId: result.booking_id,
        startTime: result.start_time,
        endTime: result.end_time,
        meetingLink: result.meeting_link,
        hostName: result.host_name || pageData?.host?.full_name || 'Host',
        companyName: result.company_name || pageData?.company?.name || 'Company',
      });

      setStep('confirmed');
      toast.success('🎉 Your meeting has been scheduled!');
    } catch (err: any) {
      console.error('Booking submission error:', err);
      toast.error(err.message || 'Failed to complete booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download ICS
  const handleDownloadICS = () => {
    if (!confirmedBooking) return;
    const icsString = generateICSContent({
      title: `${effectiveTitle} with ${confirmedBooking.hostName}`,
      description: guestNotes ? `Agenda: ${guestNotes}\nLocation: ${confirmedBooking.meetingLink}` : `Location: ${confirmedBooking.meetingLink}`,
      location: confirmedBooking.meetingLink,
      startISO: confirmedBooking.startTime,
      endISO: confirmedBooking.endTime,
      organizerName: confirmedBooking.hostName,
      guestName,
      guestEmail,
    });

    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `meeting-${confirmedBooking.hostName.toLowerCase().replace(/\s+/g, '-')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-foreground flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest animate-pulse">
            Loading Booking Calendar...
          </div>
        </div>
      </div>
    );
  }

  if (!pageData?.success || !pageData.settings) {
    return (
      <div className="min-h-screen bg-[#09090b] text-foreground flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-border/80 bg-card p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">Booking Link Not Found</h2>
          <p className="text-xs text-muted-foreground">
            This scheduling page may be inactive, or the link has changed. Please verify the URL or contact the host.
          </p>
          <Link to="/">
            <Button variant="outline" size="sm" className="mt-2 text-xs">
              Go to FastestHR Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { company, host, settings, event_types = [] } = pageData;

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground flex flex-col justify-center items-center p-3 sm:p-6 lg:p-10 selection:bg-primary/20">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[140px]" />
      </div>

      {/* Main Booking Container */}
      <div className="w-full max-w-5xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
        {step === 'confirmed' && confirmedBooking ? (
          /* Step 3: Confirmation Screen */
          <div className="p-6 sm:p-12 text-center max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                You are Scheduled!
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                A calendar invitation has been generated and sent to <strong className="text-foreground">{guestEmail}</strong>.
              </p>
            </div>

            {/* Meeting Summary Box */}
            <div className="p-5 rounded-xl bg-muted/40 border border-border/60 text-left space-y-3.5 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                  {host?.avatar_url ? (
                    <img src={host.avatar_url} alt={host.full_name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    host?.full_name?.charAt(0) || 'H'
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">{effectiveTitle}</h4>
                  <p className="text-xs text-muted-foreground">with {confirmedBooking.hostName} ({confirmedBooking.companyName})</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <span>
                    {new Date(confirmedBooking.startTime).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>
                    {new Date(confirmedBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} –{' '}
                    {new Date(confirmedBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} ({guestTimezone})
                  </span>
                </div>

                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Video className="w-4 h-4 text-blue-500" />
                  <span>Google Meet Video Call</span>
                </div>
              </div>

              {/* Join Button */}
              {confirmedBooking.meetingLink && (
                <div className="pt-2">
                  <a
                    href={confirmedBooking.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Video className="w-4 h-4" />
                    Join Google Meet Call
                  </a>
                </div>
              )}
            </div>

            {/* Quick Add to Calendar Action Buttons */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Add to your calendar
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a
                  href={generateGoogleCalendarWebUrl({
                    title: `${effectiveTitle} with ${confirmedBooking.hostName}`,
                    description: guestNotes,
                    location: confirmedBooking.meetingLink,
                    startISO: confirmedBooking.startTime,
                    endISO: confirmedBooking.endTime,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                  Google Calendar
                </a>

                <a
                  href={generateOutlookWebUrl({
                    title: `${effectiveTitle} with ${confirmedBooking.hostName}`,
                    description: guestNotes,
                    location: confirmedBooking.meetingLink,
                    startISO: confirmedBooking.startTime,
                    endISO: confirmedBooking.endTime,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  Outlook
                </a>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadICS}
                  className="h-8 text-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  Download .iCal
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('pick_time');
                  setSelectedSlot(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Schedule Another Meeting
              </Button>
            </div>
          </div>
        ) : (
          /* Step 1 & 2 Split-Pane View */
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border/70">
            {/* Left Column: Host Branding & Details */}
            <div className="lg:col-span-4 p-6 sm:p-8 space-y-6 bg-muted/10 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Company Branding */}
                <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
                  {company?.logo_url ? (
                    <img src={company.logo_url} alt={company.name} className="w-6 h-6 object-contain rounded" />
                  ) : (
                    <Building2 className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {company?.name}
                  </span>
                </div>

                {/* Host Profile */}
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base shrink-0 overflow-hidden">
                    {host?.avatar_url ? (
                      <img src={host.avatar_url} alt={host.full_name} className="w-full h-full object-cover" />
                    ) : (
                      host?.full_name?.charAt(0) || 'H'
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{host?.full_name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{host?.role || 'Host'}</p>
                  </div>
                </div>

                {/* Meeting Meta */}
                <div className="space-y-2 pt-1">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight leading-snug">
                    {effectiveTitle}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="text-xs font-medium gap-1 bg-card">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {effectiveDuration} mins
                    </Badge>

                    <Badge variant="outline" className="text-xs font-medium gap-1 bg-card text-blue-400 border-blue-500/20">
                      <Video className="w-3.5 h-3.5 text-blue-500" />
                      Google Meet
                    </Badge>
                  </div>

                  {effectiveDescription && (
                    <p className="text-xs text-muted-foreground leading-relaxed pt-2">
                      {effectiveDescription}
                    </p>
                  )}
                </div>

                {/* Event Type Switcher (if user offers multiple formats) */}
                {event_types.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Select Meeting Format:
                    </Label>
                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEventType(null)}
                        className={`text-left p-2.5 rounded-lg text-xs font-medium transition-all border ${
                          selectedEventType === null
                            ? 'bg-primary/10 border-primary text-foreground'
                            : 'bg-card border-border/60 hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {settings.title} ({settings.duration_minutes}m)
                      </button>
                      {event_types.map((et) => (
                        <button
                          key={et.id}
                          type="button"
                          onClick={() => setSelectedEventType(et)}
                          className={`text-left p-2.5 rounded-lg text-xs font-medium transition-all border ${
                            selectedEventType?.id === et.id
                              ? 'bg-primary/10 border-primary text-foreground'
                              : 'bg-card border-border/60 hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          {et.title} ({et.duration_minutes}m)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Timezone Indicator */}
              <div className="pt-6 border-t border-border/40 text-xs text-muted-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">Times shown in: <strong>{guestTimezone}</strong></span>
              </div>
            </div>

            {/* Right / Center Columns: Date & Time Picker OR Guest Form */}
            {step === 'pick_time' ? (
              <div className="lg:col-span-8 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Date Picker Grid (7 cols) */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-foreground">Select a Date</h2>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={prevMonth}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs font-semibold px-2">
                        {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={nextMonth}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                    <span>Su</span>
                    <span>Mo</span>
                    <span>Tu</span>
                    <span>We</span>
                    <span>Th</span>
                    <span>Fr</span>
                    <span>Sa</span>
                  </div>

                  {/* Calendar Matrix */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((item, idx) => {
                      const isSelected =
                        selectedDate &&
                        item.date.toDateString() === selectedDate.toDateString();

                      if (!item.isCurrentMonth) {
                        return <div key={idx} className="h-10" />;
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!item.isAvailable}
                          onClick={() => {
                            setSelectedDate(item.date);
                            setSelectedSlot(null);
                          }}
                          className={`h-10 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center relative ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-bold shadow-md scale-105 ring-2 ring-primary/40'
                              : item.isAvailable
                              ? 'bg-primary/5 hover:bg-primary/20 text-foreground hover:scale-105 border border-primary/20'
                              : 'text-muted-foreground/30 cursor-not-allowed bg-transparent'
                          }`}
                        >
                          <span>{item.date.getDate()}</span>
                          {item.isAvailable && !isSelected && (
                            <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Slots (5 cols) */}
                <div className="md:col-span-5 space-y-4 md:border-l md:border-border/60 md:pl-6">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-foreground">
                      {selectedDate
                        ? selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                        : 'Select a Date'}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {availableSlots.filter((s) => s.available).length} available slot(s)
                    </p>
                  </div>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {availableSlots.length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-muted/20 border border-dashed text-xs text-muted-foreground">
                        No available slots for this date. Please pick another day.
                      </div>
                    ) : (
                      availableSlots.map((slot, idx) => {
                        const isChosen = selectedSlot?.startISO === slot.startISO;

                        if (!slot.available) {
                          return null;
                        }

                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border text-center ${
                                isChosen
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                  : 'bg-card hover:bg-muted border-border/80 hover:border-primary/50 text-foreground'
                              }`}
                            >
                              {slot.timeFormatted}
                            </button>

                            {isChosen && (
                              <Button
                                size="sm"
                                onClick={() => setStep('guest_form')}
                                className="h-10 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 animate-in fade-in"
                              >
                                Next →
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: Guest Details Form */
              <div className="lg:col-span-8 p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('pick_time')}
                    className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Change Time
                  </Button>

                  <div className="text-right">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {selectedSlot?.timeFormatted} •{' '}
                      {selectedDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                    <span className="text-[10px] text-muted-foreground">({guestTimezone})</span>
                  </div>
                </div>

                <form onSubmit={handleSubmitBooking} className="space-y-4 max-w-lg">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground">Enter Your Details</h3>
                    <p className="text-xs text-muted-foreground">
                      Please enter your contact information to confirm your meeting reservation.
                    </p>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Your Name *</Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="John Doe"
                        required
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Email Address *</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="john@example.com"
                        required
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        required
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* LinkedIn Profile (Optional) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">LinkedIn Profile URL</Label>
                      <span className="text-[10px] text-muted-foreground font-mono">Optional</span>
                    </div>
                    <div className="relative">
                      <Linkedin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                      <Input
                        value={guestLinkedin}
                        onChange={(e) => setGuestLinkedin(e.target.value)}
                        placeholder="https://linkedin.com/in/your-profile"
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Notes / Agenda */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Meeting Purpose / Notes</Label>
                    <Textarea
                      value={guestNotes}
                      onChange={(e) => setGuestNotes(e.target.value)}
                      placeholder="Please share anything that will help prepare for our meeting..."
                      rows={3}
                      className="resize-none text-xs"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-2 shadow-sm"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                          Confirming Reservation...
                        </>
                      ) : (
                        <>
                          <CalendarCheck className="w-4 h-4" />
                          Schedule Meeting
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Powered by FastestHR Footer */}
      <div className="pt-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <span>Powered by</span>
        <Link to="/" className="font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary" />
          FastestHR
        </Link>
      </div>
    </div>
  );
}
