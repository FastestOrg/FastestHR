import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, MapPin, Play, Square, Coffee, Building, Home, Globe, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface RegularizationRequest {
  status: 'pending' | 'approved' | 'rejected';
  requested_in: string; // ISO string
  requested_out: string; // ISO string
  reason: string;
  rejection_reason?: string;
}

const parseRegularization = (reasonStr: string | null): RegularizationRequest | null => {
  if (!reasonStr) return null;
  try {
    if (reasonStr.trim().startsWith('{')) {
      return JSON.parse(reasonStr);
    }
  } catch (e) {
    // Standard string fallback
  }
  return null;
};

// Haversine formula to compute exact distance in meters between two coordinates
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Crossover shift boundary resolver
interface ResolvedShift {
  shiftStart: Date;
  shiftEnd: Date;
  shiftDateStr: string; // YYYY-MM-DD
}

const resolveShiftTimes = (currentTime: Date, startStr: string, endStr: string): ResolvedShift => {
  const [sh, sm, ss] = startStr.split(':').map(Number);
  const [eh, em, es] = endStr.split(':').map(Number);

  const isNightShift = sh > eh; // e.g. 22 > 06

  const shiftStartToday = new Date(currentTime);
  shiftStartToday.setHours(sh, sm, ss || 0, 0);

  const shiftStartYesterday = new Date(currentTime);
  shiftStartYesterday.setDate(shiftStartYesterday.getDate() - 1);
  shiftStartYesterday.setHours(sh, sm, ss || 0, 0);

  let shiftStart: Date;

  if (isNightShift) {
    // If it is a night shift and we clock in during early morning (before 12 PM noon), we belong to yesterday's shift
    if (currentTime.getHours() < 12) {
      shiftStart = shiftStartYesterday;
    } else {
      shiftStart = shiftStartToday;
    }
  } else {
    // Normal day shift
    shiftStart = shiftStartToday;
  }

  const shiftDateStr = shiftStart.toLocaleDateString('en-CA');

  const shiftEnd = new Date(shiftStart);
  if (isNightShift) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }
  shiftEnd.setHours(eh, em, es || 0, 0);

  return { shiftStart, shiftEnd, shiftDateStr };
};

// Hoisted static object configuration
const workTypeIcons: Record<string, any> = { office: Building, remote: Home, hybrid: Globe };

const statusColors: Record<string, string> = {
  present: 'border-success text-success bg-success/10',
  late: 'border-warning text-warning bg-warning/10',
  early_leave: 'border-info text-info bg-info/10',
  absent: 'border-destructive text-destructive bg-destructive/10',
  half_day: 'border-orange-500 text-orange-500 bg-orange-500/10',
};

export default function Attendance() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workType, setWorkType] = useState<'office' | 'remote' | 'hybrid'>('office');
  const [showRegularizePromptToday, setShowRegularizePromptToday] = useState<boolean>(false);

  const fetchPublicIP = async (): Promise<string | null> => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      if (!res.ok) return null;
      const data = await res.json();
      return data.ip || null;
    } catch (e) {
      console.warn('Failed to fetch public IP:', e);
      return null;
    }
  };

  const getResilientPosition = async (): Promise<GeolocationPosition> => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser. Office attendance requires location verification.');
    }

    setGeoStatus('Locating (Attempt 1: High Precision)...');
    try {
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0
        });
      });
    } catch (err: any) {
      console.warn('High accuracy location failed, trying cell/WiFi standard positioning fallback...', err);
      setGeoStatus('Locating (Attempt 2: Cell/WiFi Fallback)...');
      try {
        return await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 10000
          });
        });
      } catch (err2: any) {
        console.error('All location attempts failed:', err2);
        let errorMsg = 'Failed to acquire location. Please ensure location services are enabled, grant browser permissions, and try again.';
        if (err2.code === 1) {
          errorMsg = 'Location permission was denied. Please allow FastestHR to access your location in your browser address bar/settings.';
        } else if (err2.code === 2) {
          errorMsg = 'Location is temporarily unavailable. Check your network connection or try outdoors / near a window.';
        } else if (err2.code === 3) {
          errorMsg = 'Location request timed out. Please click Clock In/Out to try again.';
        }
        throw new Error(errorMsg);
      }
    }
  };

  const { data: employee } = useQuery({
    queryKey: ['my-employee', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('employees')
        .select('id, company_id, location_id')
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const today = new Date().toLocaleDateString('en-CA');
  const { data: todayRecord } = useQuery({
    queryKey: ['attendance-today', employee?.id, today],
    queryFn: async () => {
      if (!employee?.id) return null;
      
      // 1. Fetch active open check-in first (handles crossover night shifts)
      const { data: openRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openRecord) return openRecord;

      // 2. Fallback to physical today's record
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!employee?.id,
  });

  // Dynamic Shift Lookup
  const { data: activeShift } = useQuery({
    queryKey: ['active-shift', employee?.id, today],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data: shiftAssignment, error } = await supabase
        .from('employee_shifts')
        .select('*, shifts(*)')
        .eq('employee_id', employee.id)
        .lte('effective_from', today)
        .or(`effective_to.gte.${today},effective_to.is.null`)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching shift assignment:', error);
        return null;
      }
      return (shiftAssignment as any)?.shifts || null;
    },
    enabled: !!employee?.id,
  });

  const isAdmin = profile?.platform_role === 'company_admin' || profile?.platform_role === 'super_admin' || profile?.platform_role === 'hr_manager';

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pending-regularizations', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id || !isAdmin) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', profile.company_id)
        .like('regularization_reason', '%"status":"pending"%')
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id && isAdmin,
  });

  const [requestDialogRecord, setRequestDialogRecord] = useState<any | null>(null);
  const [requestForm, setRequestForm] = useState({
    clock_in_time: '09:00',
    clock_out_time: '18:00',
    reason: '',
  });

  const [rejectDialogRecord, setRejectDialogRecord] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const requestRegularizationMutation = useMutation({
    mutationFn: async () => {
      if (!requestDialogRecord) throw new Error("No record selected");
      if (!requestForm.reason.trim()) throw new Error("Please specify a reason");

      const dateStr = requestDialogRecord.date;
      const inDateTime = new Date(`${dateStr}T${requestForm.clock_in_time}:00`);
      const outDateTime = new Date(`${dateStr}T${requestForm.clock_out_time}:00`);

      if (outDateTime <= inDateTime) {
        throw new Error("Clock out time must be after clock in time");
      }

      const reqPayload = {
        status: 'pending',
        requested_in: inDateTime.toISOString(),
        requested_out: outDateTime.toISOString(),
        reason: requestForm.reason.trim(),
      };

      if (!employee) throw new Error("Employee record not found");

      let existingRecordId = requestDialogRecord.id;
      if (!existingRecordId) {
        const { data: dbRecord, error: findError } = await supabase
          .from('attendance')
          .select('id')
          .eq('employee_id', employee.id)
          .eq('date', dateStr)
          .maybeSingle();

        if (findError) throw findError;
        if (dbRecord) {
          existingRecordId = dbRecord.id;
        }
      }

      if (existingRecordId) {
        const { error } = await supabase
          .from('attendance')
          .update({
            regularization_reason: JSON.stringify(reqPayload)
          })
          .eq('id', existingRecordId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendance')
          .insert([{
            employee_id: employee.id,
            company_id: employee.company_id,
            date: dateStr,
            status: 'absent',
            regularization_reason: JSON.stringify(reqPayload)
          }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['pending-regularizations'] });
      setRequestDialogRecord(null);
      setRequestForm({ clock_in_time: '09:00', clock_out_time: '18:00', reason: '' });
      toast.success('Regularization request submitted successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to submit regularization request');
    }
  });

  const resolveRegularizationMutation = useMutation({
    mutationFn: async ({ recordId, status, rejectionReason }: { recordId: string, status: 'approved' | 'rejected', rejectionReason?: string }) => {
      const { data: record, error: fetchErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('id', recordId)
        .single();
      
      if (fetchErr) throw fetchErr;
      if (!record.regularization_reason) throw new Error("No request details found on record");

      const reqDetails = JSON.parse(record.regularization_reason);
      reqDetails.status = status;
      if (rejectionReason) {
        reqDetails.rejection_reason = rejectionReason;
      }

      const updateData: any = {
        regularization_reason: JSON.stringify(reqDetails)
      };

      if (status === 'approved') {
        const inDate = new Date(reqDetails.requested_in);
        const outDate = new Date(reqDetails.requested_out);
        const diffMs = outDate.getTime() - inDate.getTime();
        const breakMin = record.break_minutes || 0;
        const totalHrs = Math.max(0, (diffMs / 3600000) - (breakMin / 60));

        updateData.clock_in = reqDetails.requested_in;
        updateData.clock_out = reqDetails.requested_out;
        updateData.total_hours = parseFloat(totalHrs.toFixed(2));
        updateData.is_regularized = true;

        // Resolve assigned shift details
        let shiftStartStr = '09:00:00';
        let shiftEndStr = '18:00:00';

        try {
          const { data: empShift } = await supabase
            .from('employee_shifts')
            .select('*, shifts(*)')
            .eq('employee_id', record.employee_id)
            .lte('effective_from', record.date)
            .or(`effective_to.gte.${record.date},effective_to.is.null`)
            .maybeSingle();

          const matchedShift = empShift?.shifts;
          if (matchedShift) {
            shiftStartStr = matchedShift.start_time;
            shiftEndStr = matchedShift.end_time;
          } else {
            // dynamic fallback to any shift in the company
            const { data: companyShifts } = await supabase
              .from('shifts')
              .select('*')
              .eq('company_id', record.company_id)
              .limit(1);
            if (companyShifts && companyShifts.length > 0) {
              shiftStartStr = companyShifts[0].start_time;
              shiftEndStr = companyShifts[0].end_time;
            }
          }
        } catch (shiftErr) {
          console.error("Error querying assigned shift:", shiftErr);
        }

        // Parse shift hours and minutes
        const [sHour, sMin] = shiftStartStr.split(':').map(Number);
        const [eHour, eMin] = shiftEndStr.split(':').map(Number);

        // Compare check-in time (local hours & minutes)
        const inHour = inDate.getHours();
        const inMin = inDate.getMinutes();
        const inTotalMin = inHour * 60 + inMin;
        const shiftStartTotalMin = sHour * 60 + sMin;
        const isLate = inTotalMin > (shiftStartTotalMin + 15); // 15-minute grace limit

        // Compare check-out time (local hours & minutes)
        const outHour = outDate.getHours();
        const outMin = outDate.getMinutes();
        const outTotalMin = outHour * 60 + outMin;
        const shiftEndTotalMin = eHour * 60 + eMin;
        const isEarlyLeave = outTotalMin < shiftEndTotalMin;

        // Calculate and resolve calculated status
        if (totalHrs < 4.0) {
          updateData.status = 'half_day';
        } else if (isLate) {
          updateData.status = 'late';
        } else if (isEarlyLeave) {
          updateData.status = 'early_leave';
        } else {
          updateData.status = 'present';
        }
      }

      const { error } = await supabase
        .from('attendance')
        .update(updateData)
        .eq('id', recordId);

      if (error) throw error;

      // Real-time Notification Dispatch (Phase 5)
      try {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('user_id')
          .eq('id', record.employee_id)
          .single();

        if (employeeData?.user_id) {
          await supabase.from('notifications').insert({
            company_id: record.company_id,
            user_id: employeeData.user_id,
            type: 'attendance_regularization',
            title: `Attendance Correction ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your attendance correction request for ${record.date} has been ${status}.`,
            link: '/attendance'
          });
        }
      } catch (notifErr) {
        console.error("Error creating resolution notification:", notifErr);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['pending-regularizations'] });
      toast.success(`Regularization request ${variables.status} successfully`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update regularization request');
    }
  });

  const { data: attendanceData = [], isLoading } = useQuery({
    queryKey: ['attendance', employee?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select(`*, employees (first_name, last_name)`)
        .eq('company_id', employee!.company_id)
        .order('date', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!employee?.company_id,
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error('Employee record not found');
      if (todayRecord?.clock_in) throw new Error('Already clocked in today');
      
      const clockInTime = new Date();
      const shiftStartStr = activeShift?.start_time || '09:00:00';
      const shiftEndStr = activeShift?.end_time || '18:00:00';
      
      // Resolve shift times & date bounds (handles crossover night shifts)
      const { shiftStart, shiftDateStr } = resolveShiftTimes(clockInTime, shiftStartStr, shiftEndStr);
      
      // Calculate isLate
      const graceTime = new Date(shiftStart.getTime() + 15 * 60 * 1000);
      const isLate = clockInTime.getTime() > graceTime.getTime();

      let gpsCoords: { latitude: number; longitude: number; accuracy: number; verified: boolean } | null = null;
      let clientIP: string | null = null;
      
      // Fetch public IP address
      clientIP = await fetchPublicIP();
      
      // Location & Geofencing Check
      if (workType === 'office') {
        const { data: company, error: companyErr } = await supabase
          .from('companies')
          .select('geofence_latitude, geofence_longitude, geofence_radius, ip_whitelist')
          .eq('id', employee.company_id)
          .single();
          
        if (companyErr) {
          console.error('Failed to load company geofence settings:', companyErr);
        }

        // 1. Check IP whitelist bypass
        let ipBypassed = false;
        if (company?.ip_whitelist && clientIP) {
          const whitelistedIPs = company.ip_whitelist.split(',').map((ip: string) => ip.trim());
          if (whitelistedIPs.includes(clientIP)) {
            ipBypassed = true;
          }
        }

        if (!ipBypassed) {
          // Fetch current physical GPS coordinates using our resilient helper
          const position = await getResilientPosition();

          const { latitude, longitude, accuracy } = position.coords;
          
          // Fetch active company locations
          const { data: locations } = await supabase
            .from('company_locations')
            .select('*')
            .eq('company_id', employee.company_id)
            .eq('is_active', true);

          let locationMatched = false;
          let matchedLocationId: string | null = null;
          let allowedRadius = 200;
          let distance = 0;

          // A. Check if the employee is assigned to a specific branch/location
          if (employee.location_id) {
            const assignedLoc = locations?.find((loc: any) => loc.id === employee.location_id);
            if (assignedLoc) {
              distance = calculateDistance(latitude, longitude, assignedLoc.latitude, assignedLoc.longitude);
              allowedRadius = assignedLoc.radius_meters || 200;
              if (distance <= allowedRadius) {
                locationMatched = true;
                matchedLocationId = assignedLoc.id;
              } else {
                throw new Error(`Location verification failed. You are outside your assigned office branch [${assignedLoc.name}] boundary (${Math.round(distance)}m away, allowed radius: ${allowedRadius}m).`);
              }
            }
          }

          // B. If no assigned location or assigned location not found, search in all active locations
          if (!locationMatched && locations && locations.length > 0) {
            let closestLoc: any = null;
            let minDistance = Infinity;

            for (const loc of locations) {
              const d = calculateDistance(latitude, longitude, loc.latitude, loc.longitude);
              const rad = loc.radius_meters || 200;
              if (d <= rad && d < minDistance) {
                minDistance = d;
                closestLoc = loc;
              }
            }

            if (closestLoc) {
              locationMatched = true;
              matchedLocationId = closestLoc.id;
              distance = minDistance;
              allowedRadius = closestLoc.radius_meters || 200;
            }
          }

          // C. If still not matched, fall back to company default coordinates
          if (!locationMatched && company?.geofence_latitude && company?.geofence_longitude) {
            distance = calculateDistance(latitude, longitude, company.geofence_latitude, company.geofence_longitude);
            allowedRadius = company.geofence_radius || 200;
            if (distance <= allowedRadius) {
              locationMatched = true;
            }
          }

          // D. If not matched, and any location constraints are set
          if (!locationMatched) {
            if ((locations && locations.length > 0) || (company?.geofence_latitude && company?.geofence_longitude)) {
              throw new Error(`Location verification failed. You are outside the allowed office boundaries.`);
            }
          }

          gpsCoords = {
            latitude,
            longitude,
            accuracy,
            verified: true,
            location_id: matchedLocationId || undefined
          } as any;
        }
      }

      const { error } = await supabase
        .from('attendance')
        .insert([{
          employee_id: employee.id,
          company_id: employee.company_id,
          date: shiftDateStr,
          clock_in: clockInTime.toISOString(),
          status: (isLate ? 'late' : 'present') as any,
          clock_in_ip: clientIP,
          clock_in_location: { 
            work_type: workType,
            ip_address: clientIP || 'unknown',
            ...(gpsCoords ? { gps: gpsCoords } : {})
          },
          location_id: gpsCoords?.location_id || null
        }]);

      if (error) throw error;
      if (isLate) toast.warning(`You clocked in late. Shift starts at ${shiftStartStr.substring(0, 5)}.`);
    },
    onSuccess: () => {
      setGeoStatus(null);
      setShowGpsTroubleshooting(false);
      setShowRegularizePromptToday(false);
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(`Clocked in (${workType})`);
    },
    onError: (err: any) => {
      setGeoStatus(null);
      if (err?.message && (err.message.includes('Location') || err.message.includes('GPS') || err.message.includes('locate') || err.message.includes('position') || err.message.includes('permission') || err.message.includes('verification'))) {
        setShowGpsTroubleshooting(true);
        setShowRegularizePromptToday(true);
      }
      toast.error(err?.message || 'Failed to clock in');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayRecord?.id) throw new Error('No active clock-in record found');
      if (todayRecord.clock_out) throw new Error('Already clocked out');
      
      const clockOutTime = new Date();
      const clockInTime = new Date(todayRecord.clock_in);
      
      // Calculate total working hours excluding break minutes
      const breakMins = todayRecord.break_minutes || 0;
      const totalHours = Math.max(0, (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) - (breakMins / 60));
      
      const shiftStartStr = activeShift?.start_time || '09:00:00';
      const shiftEndStr = activeShift?.end_time || '18:00:00';
      
      // Resolve crossover shift end time using clock in time for stability
      const { shiftEnd } = resolveShiftTimes(clockInTime, shiftStartStr, shiftEndStr);
      const isEarlyLeave = clockOutTime.getTime() < shiftEnd.getTime();

      let gpsCoords: { latitude: number; longitude: number; accuracy: number; verified: boolean } | null = null;
      let clientIP: string | null = null;
      clientIP = await fetchPublicIP();

      const workTypeUsed = (todayRecord.clock_in_location as any)?.work_type || 'office';

      // Capture GPS coordinates on clock out for office work
      if (workTypeUsed === 'office') {
        const { data: company } = await supabase
          .from('companies')
          .select('geofence_latitude, geofence_longitude, geofence_radius, ip_whitelist')
          .eq('id', employee!.company_id)
          .single();

        let ipBypassed = false;
        if (company?.ip_whitelist && clientIP) {
          const whitelistedIPs = company.ip_whitelist.split(',').map((ip: string) => ip.trim());
          if (whitelistedIPs.includes(clientIP)) {
            ipBypassed = true;
          }
        }

        if (!ipBypassed) {
          try {
            const position = await getResilientPosition();
            const { latitude, longitude, accuracy } = position.coords;

            // Fetch active company locations
            const { data: locations } = await supabase
              .from('company_locations')
              .select('*')
              .eq('company_id', employee!.company_id)
              .eq('is_active', true);

            let locationMatched = false;
            let matchedLocationId = todayRecord.location_id;
            let allowedRadius = 200;
            let distance = 0;

            // A. If clock-in matched a specific location ID, strictly validate clock-out against it
            if (matchedLocationId) {
              const clockInLoc = locations?.find((loc: any) => loc.id === matchedLocationId);
              if (clockInLoc) {
                distance = calculateDistance(latitude, longitude, clockInLoc.latitude, clockInLoc.longitude);
                allowedRadius = clockInLoc.radius_meters || 200;
                if (distance <= allowedRadius) {
                  locationMatched = true;
                } else {
                  throw new Error(`Location verification failed. You are outside the office branch [${clockInLoc.name}] boundary on clock-out (${Math.round(distance)}m away, allowed radius: ${allowedRadius}m).`);
                }
              }
            }

            // B. If no specific location was matched or found during clock-in, check active locations list
            if (!locationMatched && locations && locations.length > 0) {
              let closestLoc: any = null;
              let minDistance = Infinity;

              for (const loc of locations) {
                const d = calculateDistance(latitude, longitude, loc.latitude, loc.longitude);
                const rad = loc.radius_meters || 200;
                if (d <= rad && d < minDistance) {
                  minDistance = d;
                  closestLoc = loc;
                }
              }

              if (closestLoc) {
                locationMatched = true;
                matchedLocationId = closestLoc.id;
                distance = minDistance;
                allowedRadius = closestLoc.radius_meters || 200;
              }
            }

            // C. Fallback to company default coordinates
            if (!locationMatched && company?.geofence_latitude && company?.geofence_longitude) {
              distance = calculateDistance(latitude, longitude, company.geofence_latitude, company.geofence_longitude);
              allowedRadius = company.geofence_radius || 200;
              if (distance <= allowedRadius) {
                locationMatched = true;
              }
            }

            // D. Raise error if geofence constraints exist but none were satisfied
            if (!locationMatched) {
              if ((locations && locations.length > 0) || (company?.geofence_latitude && company?.geofence_longitude)) {
                throw new Error(`Location verification failed on clock-out. You are outside the allowed office boundaries.`);
              }
            }

            gpsCoords = {
              latitude,
              longitude,
              accuracy,
              verified: true,
              location_id: matchedLocationId || undefined
            } as any;
          } catch (e: any) {
            console.error('Failed to capture GPS coordinates on clock out:', e);
            throw new Error(e.message || 'GPS verification failed on clock-out. Please ensure location services are active.');
          }
        }
      }
      
      const { error } = await supabase
        .from('attendance')
        .update({
          clock_out: clockOutTime.toISOString(),
          total_hours: parseFloat(totalHours.toFixed(2)),
          status: (isEarlyLeave ? 'early_leave' : todayRecord.status) as any,
          clock_out_location: {
            work_type: workTypeUsed,
            ip_address: clientIP || 'unknown',
            ...(gpsCoords ? { gps: gpsCoords } : {})
          },
          location_id: gpsCoords?.location_id || todayRecord.location_id || null
        })
        .eq('id', todayRecord.id);

      if (error) throw error;
      if (isEarlyLeave) toast.info(`Early leave recorded. Shift ends at ${shiftEndStr.substring(0, 5)}.`);
    },
    onSuccess: () => {
      setGeoStatus(null);
      setShowGpsTroubleshooting(false);
      setShowRegularizePromptToday(false);
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Clocked out successfully');
    },
    onError: (err: any) => {
      setGeoStatus(null);
      if (err?.message && (err.message.includes('Location') || err.message.includes('GPS') || err.message.includes('locate') || err.message.includes('position') || err.message.includes('permission') || err.message.includes('verification'))) {
        setShowGpsTroubleshooting(true);
        setShowRegularizePromptToday(true);
      }
      toast.error(err?.message || 'Failed to clock out');
    },
  });

  const breakMutation = useMutation({
    mutationFn: async () => {
      if (!todayRecord?.id) throw new Error('No clock-in record found for today');
      const clockInLoc = (todayRecord.clock_in_location && typeof todayRecord.clock_in_location === 'object') 
        ? { ...todayRecord.clock_in_location } 
        : {};
      
      const isOnBreak = !!(clockInLoc as any).active_break_start;
      const now = new Date();
      
      let updatedBreakMinutes = todayRecord.break_minutes || 0;
      if (isOnBreak) {
        const start = new Date((clockInLoc as any).active_break_start);
        const diffMins = Math.max(1, Math.round((now.getTime() - start.getTime()) / (1000 * 60)));
        updatedBreakMinutes += diffMins;
        delete (clockInLoc as any).active_break_start;
      } else {
        (clockInLoc as any).active_break_start = now.toISOString();
      }
      
      const { error } = await supabase
        .from('attendance')
        .update({
          break_minutes: updatedBreakMinutes,
          clock_in_location: clockInLoc,
        })
        .eq('id', todayRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      const clockInLoc = todayRecord?.clock_in_location as any;
      const starting = !clockInLoc?.active_break_start;
      toast.info(starting ? 'Break started' : 'Break ended');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update break status'),
  });

  const isClockedIn = !!todayRecord?.clock_in && !todayRecord?.clock_out;
  const isClockedOut = !!todayRecord?.clock_out;
  const isOnBreak = !!(todayRecord?.clock_in_location && typeof todayRecord.clock_in_location === 'object' && (todayRecord.clock_in_location as any).active_break_start);

  let runningTotal = '00:00:00';
  if (todayRecord?.clock_in) {
    const start = new Date(todayRecord.clock_in);
    const end = todayRecord.clock_out ? new Date(todayRecord.clock_out) : currentTime;
    const diff = Math.max(0, end.getTime() - start.getTime());
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    runningTotal = `${h}:${m}:${s}`;
  }

  const getWorkTypeFromRecord = (record: any) => {
    const loc = record.clock_in_location;
    if (loc && typeof loc === 'object' && 'work_type' in loc) return loc.work_type;
    return null;
  };

  const todayWorkType = todayRecord ? getWorkTypeFromRecord(todayRecord) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Tracking</h1>
          <p className="text-muted-foreground mt-1">Real-time attendance & timesheet management</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <CardHeader className="border-b border-border/50 pb-4 relative z-10">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Current Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 relative z-10">
            <div className="text-center">
              <div className="text-6xl font-display font-bold tracking-tight mb-2 text-foreground">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </div>
              <p className="text-muted-foreground text-sm font-medium">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Active Shift details if present */}
            {activeShift && (
              <div className="text-center">
                <Badge variant="secondary" className="px-3 py-1 font-semibold text-xs border border-primary/20 bg-primary/5 text-primary">
                  Shift: {activeShift.name} ({activeShift.start_time.substring(0, 5)} - {activeShift.end_time.substring(0, 5)})
                </Badge>
              </div>
            )}

            {/* Work Type Selector — only before clock-in */}
            {!todayRecord?.clock_in && (
              <div className="flex justify-center gap-2">
                {(['office', 'remote', 'hybrid'] as const).map(type => {
                  const Icon = workTypeIcons[type];
                  return (
                    <Button
                      key={type}
                      variant={workType === type ? 'default' : 'outline'}
                      size="sm"
                      className="gap-2 capitalize"
                      onClick={() => setWorkType(type)}
                    >
                      <Icon className="w-4 h-4" />
                      {type}
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Show work type after clock-in */}
            {todayWorkType && (
              <div className="flex justify-center gap-2 items-center">
                <Badge variant="outline" className="gap-1 capitalize border-primary/30 text-primary">
                  {todayWorkType === 'office' && <Building className="w-3 h-3" />}
                  {todayWorkType === 'remote' && <Home className="w-3 h-3" />}
                  {todayWorkType === 'hybrid' && <Globe className="w-3 h-3" />}
                  {todayWorkType}
                </Badge>
              </div>
            )}

            {/* Active Break Glowing Indicator */}
            {isOnBreak && (
              <div className="flex justify-center animate-pulse">
                <Badge variant="outline" className="border-warning text-warning bg-warning/5 gap-1.5 text-xs font-semibold px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-warning animate-ping"></span>
                  On Break (Started {new Date((todayRecord?.clock_in_location as any).active_break_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                </Badge>
              </div>
            )}

            {/* Real-time Geolocation Status Loading Banner */}
            {geoStatus && (
              <div className="flex justify-center items-center gap-2 text-xs text-primary font-medium bg-primary/5 rounded border border-primary/20 px-3 py-2 w-full max-w-sm mx-auto animate-pulse">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                <span>{geoStatus}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 w-full max-w-md mx-auto sm:flex sm:justify-center sm:gap-4">
              <Button
                size="lg"
                className="w-full sm:w-32 bg-success text-success-foreground hover:bg-success/90 px-2 sm:px-4 text-xs sm:text-sm"
                onClick={() => clockInMutation.mutate()}
                disabled={isClockedIn || isClockedOut || clockInMutation.isPending || isOnBreak}
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> Clock In
              </Button>
              <Button
                size="lg"
                variant={isOnBreak ? 'default' : 'outline'}
                className={`w-full sm:w-32 px-2 sm:px-4 text-xs sm:text-sm ${isOnBreak ? 'bg-warning text-warning-foreground hover:bg-warning/90' : 'border-warning text-warning hover:bg-warning/10'}`}
                onClick={() => breakMutation.mutate()}
                disabled={!isClockedIn || breakMutation.isPending}
              >
                <Coffee className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> {isOnBreak ? 'End Break' : 'Break'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-32 border-destructive text-destructive hover:bg-destructive/10 px-2 sm:px-4 text-xs sm:text-sm"
                onClick={() => clockOutMutation.mutate()}
                disabled={!isClockedIn || clockOutMutation.isPending || isOnBreak}
              >
                <Square className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> Clock Out
              </Button>
            </div>

            <div className="pt-4 border-t border-border/50 flex justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{isClockedIn ? 'Active Session' : isClockedOut ? 'Session Complete' : 'Not Clocked In'}</span>
                {(todayRecord?.status as string) === 'late' && (
                  <Badge variant="outline" className="border-warning text-warning bg-warning/10 text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" /> Late
                  </Badge>
                )}
              </div>
              <div className="font-medium text-foreground">Total: <span className="text-primary">{runningTotal}</span></div>
            </div>
          </CardContent>
        </Card>

        {showRegularizePromptToday && (
          <Card className="border-primary/30 bg-primary/5 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-3 mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                <AlertTriangle className="h-4 w-4" /> Location Verification Bypass
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              <p className="text-muted-foreground">
                Unable to verify your location? To prevent you from being locked out of your shift, you can immediately file a manual **Attendance Correction / Regularization** request. 
              </p>
              <div className="flex gap-2 justify-end">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowRegularizePromptToday(false)} 
                  className="h-8 px-3 text-xs"
                >
                  Ignore
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => {
                    const todayDate = new Date().toLocaleDateString('en-CA');
                    setRequestDialogRecord({
                      date: todayDate,
                      id: todayRecord?.id || null // Pass existing todayRecord id if any, else null (triggers insert!)
                    });
                    
                    // Pre-fill form based on default shift times or actuals
                    const defaultIn = activeShift?.start_time?.substring(0, 5) || '09:00';
                    const defaultOut = activeShift?.end_time?.substring(0, 5) || '18:00';
                    
                    setRequestForm({
                      clock_in_time: defaultIn,
                      clock_out_time: defaultOut,
                      reason: 'GPS Geofencing Bypass: Browser was unable to accurately verify my physical coordinates at the office.'
                    });
                  }}
                  className="h-8 px-3 text-xs bg-primary hover:bg-primary/95 text-primary-foreground font-medium"
                >
                  Request Regularization
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showGpsTroubleshooting && (
          <Card className="border-warning/30 bg-warning/5 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-3 mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" /> GPS Troubleshooting Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-muted-foreground">
              <p>If FastestHR is having trouble acquiring your exact coordinates, try the following steps:</p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>
                  <strong className="text-foreground">Enable Browser Permission:</strong> Click the settings/lock icon next to the URL bar and ensure <strong>Location Access</strong> is set to <strong>Allow</strong>.
                </li>
                <li>
                  <strong className="text-foreground">Enable Device Location:</strong> Go to your OS settings (Windows: Settings &gt; Privacy &gt; Location) and ensure location services are enabled for your browser.
                </li>
                <li>
                  <strong className="text-foreground">Weak Signal Fallback:</strong> Indoors or thick walls can block physical GPS. Moving closer to a window or switching to Wi-Fi can help the system resolve your location.
                </li>
              </ul>
              <div className="pt-2 text-right">
                <Button size="sm" variant="ghost" onClick={() => setShowGpsTroubleshooting(false)} className="h-7 px-2 text-[10px]">
                  Dismiss Guidance
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle>Today's Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Clock In</span>
                <span className="font-medium">{todayRecord?.clock_in ? new Date(todayRecord.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Clock Out</span>
                <span className="font-medium">{todayRecord?.clock_out ? new Date(todayRecord.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Work Type</span>
                <span className="font-medium capitalize">{todayWorkType || '—'}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Break</span>
                <span className="font-medium">{todayRecord?.break_minutes || 0} min</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-medium text-primary">{todayRecord?.total_hours?.toFixed(2) || runningTotal}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded border border-border/50 bg-background/50">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={statusColors[todayRecord?.status || ''] || 'border-muted text-muted-foreground'}>
                  {(todayRecord?.status as string) === 'late' ? '⚠ Late' : isClockedIn ? 'Active' : isClockedOut ? 'Completed' : 'Pending'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Regularization Requests Panel */}
      {isAdmin && pendingRequests.length > 0 && (
        <Card className="border-warning/30 bg-warning/5 animate-in fade-in slide-in-from-top-4 duration-500 mb-6">
          <CardHeader className="pb-2 border-b border-warning/10">
            <CardTitle className="text-warning text-sm flex items-center gap-2 uppercase tracking-wider font-semibold">
              <AlertTriangle className="h-4 w-4" /> Attendance Regularization Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {pendingRequests.map((req: any) => {
              const details = parseRegularization(req.regularization_reason);
              if (!details) return null;
              
              const formatTime = (isoStr: string) => {
                return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              };

              return (
                <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg border border-warning/20 bg-background/50 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      {req.employees?.first_name} {req.employees?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Date: <span className="font-medium text-foreground">{req.date}</span> &bull; 
                      Original: <span className="font-medium text-foreground">{req.clock_in ? formatTime(req.clock_in) : '—'} - {req.clock_out ? formatTime(req.clock_out) : '—'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested Correction: <span className="font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded">{formatTime(details.requested_in)} - {formatTime(details.requested_out)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground italic mt-1">
                      Reason: "{details.reason}"
                    </p>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-success text-success hover:bg-success/10 h-8 px-3 text-xs"
                      disabled={resolveRegularizationMutation.isPending}
                      onClick={() => resolveRegularizationMutation.mutate({ recordId: req.id, status: 'approved' })}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10 h-8 px-3 text-xs"
                      disabled={resolveRegularizationMutation.isPending}
                      onClick={() => {
                        setRejectDialogRecord(req);
                        setRejectionReason('');
                      }}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle>Recent Logs</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
            {isLoading ? <p className="text-muted-foreground py-4 text-center">Loading Data...</p> : attendanceData.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center">No recent records found.</p>
            ) : (
                <div className="divide-y divide-border/50">
                  {attendanceData.map((record: any) => {
                    const wt = getWorkTypeFromRecord(record);
                    const regDetails = parseRegularization(record.regularization_reason);
                    return (
                    <div key={record.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:bg-muted/30 p-2.5 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-semibold text-foreground">
                            {(record.employees as any)?.first_name} {(record.employees as any)?.last_name}
                          </div>
                          <div className="text-muted-foreground text-xs flex items-center gap-2 mt-0.5">
                            {record.date}
                            {wt && (
                              <Badge variant="outline" className="text-[9px] capitalize gap-1">
                                {wt === 'remote' && <Home className="w-2.5 h-2.5" />}
                                {wt === 'office' && <Building className="w-2.5 h-2.5" />}
                                {wt === 'hybrid' && <Globe className="w-2.5 h-2.5" />}
                                {wt}
                              </Badge>
                            )}
                            {record.status === 'late' && (
                              <Badge variant="outline" className="text-[9px] border-warning text-warning bg-warning/10">Late</Badge>
                            )}
                            {record.is_regularized && (
                              <Badge variant="outline" className="text-[9px] border-success text-success bg-success/5 font-semibold">✓ Regularized</Badge>
                            )}
                            {regDetails && regDetails.status === 'pending' && (
                              <Badge variant="outline" className="text-[9px] border-warning text-warning bg-warning/5 animate-pulse">Pending Correction</Badge>
                            )}
                            {regDetails && regDetails.status === 'rejected' && (
                              <Badge variant="outline" className="text-[9px] border-destructive text-destructive bg-destructive/5" title={regDetails.rejection_reason}>Correction Rejected</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 items-center text-left sm:text-right justify-between sm:justify-end border-t border-border/10 pt-2 sm:pt-0 sm:border-none w-full sm:w-auto">
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase block">In</span>
                          <span className="font-medium text-foreground">{record.clock_in ? new Date(record.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase block">Out</span>
                          <span className="font-medium text-foreground">{record.clock_out ? new Date(record.clock_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
                        </div>
                        <div className="w-16">
                          <span className="text-muted-foreground text-[10px] uppercase block">Total</span>
                          <span className="font-semibold text-primary">{record.total_hours?.toFixed(2) || '0.00'}h</span>
                        </div>
                        {!record.is_regularized && (!regDetails || regDetails.status !== 'pending') && record.employee_id === employee?.id && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs border border-primary/20 text-primary hover:bg-primary/10 px-2 rounded-md"
                            onClick={() => {
                              setRequestDialogRecord(record);
                              if (record.clock_in) {
                                const inTime = new Date(record.clock_in);
                                setRequestForm(f => ({ ...f, clock_in_time: inTime.toTimeString().substring(0, 5) }));
                              }
                              if (record.clock_out) {
                                const outTime = new Date(record.clock_out);
                                setRequestForm(f => ({ ...f, clock_out_time: outTime.toTimeString().substring(0, 5) }));
                              }
                            }}
                          >
                            Correct
                          </Button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
            )}
        </CardContent>
      </Card>

      <Dialog open={!!requestDialogRecord} onOpenChange={(open) => !open && setRequestDialogRecord(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Attendance Correction</DialogTitle>
            <DialogDescription>
              Submit actual punch-in/out times for {requestDialogRecord?.date}. This correction will be sent to HR/Manager for review.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="req-in">Clock In Time</Label>
                <Input
                  id="req-in"
                  type="time"
                  value={requestForm.clock_in_time}
                  onChange={(e) => setRequestForm(f => ({ ...f, clock_in_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-out">Clock Out Time</Label>
                <Input
                  id="req-out"
                  type="time"
                  value={requestForm.clock_out_time}
                  onChange={(e) => setRequestForm(f => ({ ...f, clock_out_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-reason">Justification Reason</Label>
              <Textarea
                id="req-reason"
                placeholder="Forgot to punch-in, GPS geofencing error..."
                value={requestForm.reason}
                onChange={(e) => setRequestForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogRecord(null)}>Cancel</Button>
            <Button onClick={() => requestRegularizationMutation.mutate()} disabled={requestRegularizationMutation.isPending}>
              {requestRegularizationMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectDialogRecord} onOpenChange={(open) => !open && setRejectDialogRecord(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Reject Regularization Request
            </DialogTitle>
            <DialogDescription>
              Please provide a brief explanation or feedback explaining why this regularization request is being rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-2">
              <Label htmlFor="reject-reason" className="text-xs font-semibold text-muted-foreground uppercase">Reason for Rejection</Label>
              <Textarea
                id="reject-reason"
                placeholder="e.g. Requested hours do not match swipe records, please verify dates..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px] border-border/50 bg-background/50 focus-visible:ring-destructive resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogRecord(null)}>Cancel</Button>
            <Button 
              variant="destructive"
              disabled={resolveRegularizationMutation.isPending || !rejectionReason.trim()}
              onClick={() => {
                if (rejectDialogRecord) {
                  resolveRegularizationMutation.mutate({ 
                    recordId: rejectDialogRecord.id, 
                    status: 'rejected', 
                    rejectionReason: rejectionReason.trim() 
                  }, {
                    onSuccess: () => {
                      setRejectDialogRecord(null);
                      setRejectionReason('');
                    }
                  });
                }
              }}
            >
              {resolveRegularizationMutation.isPending ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
