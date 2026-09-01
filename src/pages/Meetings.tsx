import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CalendarClock,
  Calendar,
  Clock,
  Link as LinkIcon,
  Video,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  UserMeetingSettings,
  MeetingEventType,
  MeetingBooking,
  DEFAULT_WEEKLY_SCHEDULE,
} from '@/types/meeting';
import { MeetingsOverview } from '@/components/meetings/MeetingsOverview';
import { WorkingHoursEditor } from '@/components/meetings/WorkingHoursEditor';
import { GoogleCalendarCard } from '@/components/meetings/GoogleCalendarCard';
import { ShareBookingLinks } from '@/components/meetings/ShareBookingLinks';

export default function Meetings() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('bookings');

  const userId = profile?.id;
  const companyId = profile?.company_id;

  // 1. Fetch Company info (for slug)
  const { data: company } = useQuery({
    queryKey: ['company-meta', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug, logo_url')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // 2. Fetch User Meeting Settings
  const {
    data: settings,
    isLoading: isSettingsLoading,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['user-meeting-settings', userId],
    queryFn: async () => {
      if (!userId || !companyId) return null;

      const { data, error } = await supabase
        .from('user_meeting_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching meeting settings:', error);
        return null;
      }

      // If settings don't exist yet, auto-provision initial defaults
      if (!data) {
        const defaultSlug = (profile?.full_name || 'user')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');

        const initialSettings: Partial<UserMeetingSettings> = {
          user_id: userId,
          company_id: companyId,
          booking_slug: defaultSlug || 'meet',
          title: 'Interview',
          description: 'Welcome! Please select a convenient time on my calendar for our conversation.',
          duration_minutes: 15,
          location_type: 'google_meet',
          weekly_schedule: DEFAULT_WEEKLY_SCHEDULE,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          min_notice_hours: 2,
          max_future_days: 7,
          google_calendar_connected: false,
          auto_google_meet: true,
          is_active: true,
        };

        const { data: createdData, error: createError } = await supabase
          .from('user_meeting_settings')
          .insert(initialSettings)
          .select()
          .single();

        if (createError) {
          console.error('Error auto-creating meeting settings:', createError);
          return null;
        }
        return createdData as UserMeetingSettings;
      }

      return data as UserMeetingSettings;
    },
    enabled: !!userId && !!companyId,
  });

  // 3. Fetch Event Types
  const { data: eventTypes = [], isLoading: isEventTypesLoading } = useQuery({
    queryKey: ['meeting-event-types', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('meeting_event_types')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as MeetingEventType[];
    },
    enabled: !!userId,
  });

  // 4. Fetch Bookings
  const {
    data: bookings = [],
    isLoading: isBookingsLoading,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['meeting-bookings', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('meeting_bookings')
        .select('*')
        .eq('host_user_id', userId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as MeetingBooking[];
    },
    enabled: !!userId,
  });

  // Mutate / Update Settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<UserMeetingSettings>) => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_meeting_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-meeting-settings', userId], data);
    },
  });

  // Mutate / Save Event Type
  const saveEventTypeMutation = useMutation({
    mutationFn: async (eventType: Partial<MeetingEventType>) => {
      if (!userId || !companyId) throw new Error('Not authenticated');

      if (eventType.id) {
        const { error } = await supabase
          .from('meeting_event_types')
          .update({
            ...eventType,
            updated_at: new Date().toISOString(),
          })
          .eq('id', eventType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meeting_event_types').insert({
          ...eventType,
          user_id: userId,
          company_id: companyId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-event-types', userId] });
      toast.success('Event type saved successfully!');
    },
  });

  // Mutate / Delete Event Type
  const deleteEventTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meeting_event_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-event-types', userId] });
      toast.success('Event type deleted');
    },
  });

  // Mutate / Cancel Booking
  const cancelBookingMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      const { error } = await supabase
        .from('meeting_bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: reason || 'Cancelled by host',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-bookings', userId] });
    },
  });

  const companySlug = company?.slug || 'company';
  const effectiveSlug = settings?.booking_slug || 'meet';
  const publicBookingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${companySlug}/${effectiveSlug}`
    : `/${companySlug}/${effectiveSlug}`;

  const copyBookingLink = () => {
    navigator.clipboard.writeText(publicBookingUrl);
    toast.success('📋 Booking link copied to clipboard!');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              Meeting & Scheduling
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono text-xs hidden sm:inline-flex">
                Instant Scheduler
              </Badge>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage your personal working hours, sync with Google Calendar, and share your unique booking link.
            </p>
          </div>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyBookingLink}
            className="h-9 gap-1.5 text-xs shadow-sm"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            Copy Link
          </Button>

          <a
            href={publicBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold transition-colors bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-3.5 gap-1.5 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Booking Page
          </a>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-11 p-1 bg-muted/60 border border-border/50">
          <TabsTrigger value="bookings" className="text-xs sm:text-sm gap-2 font-medium">
            <Calendar className="w-4 h-4 text-primary" />
            Bookings ({bookings.filter(b => b.status === 'confirmed').length})
          </TabsTrigger>

          <TabsTrigger value="schedule" className="text-xs sm:text-sm gap-2 font-medium">
            <Clock className="w-4 h-4 text-indigo-500" />
            Working Hours
          </TabsTrigger>

          <TabsTrigger value="google-calendar" className="text-xs sm:text-sm gap-2 font-medium">
            <Video className="w-4 h-4 text-blue-500" />
            Google Calendar
            {settings?.google_calendar_connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            )}
          </TabsTrigger>

          <TabsTrigger value="share" className="text-xs sm:text-sm gap-2 font-medium">
            <LinkIcon className="w-4 h-4 text-purple-500" />
            Share & Links
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Bookings Overview */}
        <TabsContent value="bookings" className="space-y-4">
          <MeetingsOverview
            bookings={bookings}
            isLoading={isBookingsLoading}
            onCancelBooking={async (bookingId, reason) => {
              await cancelBookingMutation.mutateAsync({ bookingId, reason });
            }}
            gcalAccessToken={settings?.google_access_token}
            onNavigateToShare={() => setActiveTab('share')}
          />
        </TabsContent>

        {/* Tab 2: Working Hours & Availability */}
        <TabsContent value="schedule" className="space-y-4">
          <WorkingHoursEditor
            settings={settings}
            onSaveSettings={async (updates) => {
              await updateSettingsMutation.mutateAsync(updates);
            }}
            isLoading={isSettingsLoading || updateSettingsMutation.isPending}
          />
        </TabsContent>

        {/* Tab 3: Google Calendar Integration */}
        <TabsContent value="google-calendar" className="space-y-4">
          <GoogleCalendarCard
            settings={settings}
            onUpdateSettings={async (updates) => {
              await updateSettingsMutation.mutateAsync(updates);
            }}
            isLoading={isSettingsLoading || updateSettingsMutation.isPending}
          />
        </TabsContent>

        {/* Tab 4: Shareable Links & Event Types */}
        <TabsContent value="share" className="space-y-4">
          <ShareBookingLinks
            settings={settings}
            companySlug={companySlug}
            eventTypes={eventTypes}
            onUpdateSettings={async (updates) => {
              await updateSettingsMutation.mutateAsync(updates);
            }}
            onSaveEventType={async (et) => {
              await saveEventTypeMutation.mutateAsync(et);
            }}
            onDeleteEventType={async (id) => {
              await deleteEventTypeMutation.mutateAsync(id);
            }}
            isLoading={isEventTypesLoading || isSettingsLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
