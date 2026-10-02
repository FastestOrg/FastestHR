import { supabase } from '@/integrations/supabase/client';

export interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
}

/**
 * Parses user agent string into device type, browser, and OS
 */
export function parseUserAgent(ua = navigator.userAgent): DeviceInfo {
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect OS
  let os = 'Unknown OS';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X 1[0-9]_[0-9]+/i.test(ua)) {
    const match = ua.match(/Mac OS X (1[0-9]_[0-9]+)/i);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/iPhone OS ([0-9_]+)/i.test(ua)) {
    const match = ua.match(/iPhone OS ([0-9_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Android ([0-9.]+)/i.test(ua)) {
    const match = ua.match(/Android ([0-9.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Detect Browser
  let browser = 'Unknown Browser';
  if (/Edg\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/Edg\/([0-9.]+)/i);
    browser = `Edge ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (/Chrome\/([0-9.]+)/i.test(ua) && !/Edg/i.test(ua)) {
    const match = ua.match(/Chrome\/([0-9.]+)/i);
    browser = `Chrome ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    const match = ua.match(/Version\/([0-9.]+)/i);
    browser = `Safari ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/Firefox\/([0-9.]+)/i);
    browser = `Firefox ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (/Opera|OPR\/([0-9.]+)/i.test(ua)) {
    browser = 'Opera';
  }

  return { deviceType, browser, os };
}

let isLogging = false;

/**
 * Captures and records a login event to the employee_login_logs table via Supabase RPC
 */
export async function recordUserLogin(
  status: 'success' | 'failed' = 'success',
  loginMethod = 'password'
): Promise<void> {
  if (isLogging) return;
  
  // Guard with session storage to avoid duplicate logs in the same session
  const lastLoggedSession = sessionStorage.getItem('last_login_logged_at');
  const now = Date.now();
  if (lastLoggedSession && now - parseInt(lastLoggedSession, 10) < 5 * 60 * 1000) {
    return; // Logged within last 5 minutes
  }

  isLogging = true;
  try {
    const ua = navigator.userAgent;
    const { deviceType, browser, os } = parseUserAgent(ua);

    let ip = 'Unknown IP';
    let city: string | null = null;
    let country: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const ipData = await res.json();
        ip = ipData.ip || ip;
        city = ipData.city || null;
        country = ipData.country_name || null;
      }
    } catch {
      // Fallback if third party IP check fails
      ip = 'Direct Connection';
    }

    const { error } = await supabase.rpc('record_login_log', {
      p_ip_address: ip,
      p_user_agent: ua.slice(0, 500),
      p_device_type: deviceType,
      p_browser: browser,
      p_os: os,
      p_city: city,
      p_country: country,
      p_status: status,
      p_login_method: loginMethod,
    });

    if (!error) {
      sessionStorage.setItem('last_login_logged_at', now.toString());
    }
  } catch (err) {
    console.warn('Failed to record login activity log:', err);
  } finally {
    isLogging = false;
  }
}
