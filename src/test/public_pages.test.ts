import { describe, it, expect } from 'vitest';
import { sanitizeCsvCell } from '@/lib/csv-parser';

describe('Security & Public Page Accessibility Suite', () => {
  describe('CWE-1236: CSV Formula Injection Prevention', () => {
    it('prepends a single quote to dangerous spreadsheet formula characters', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
      expect(sanitizeCsvCell('+12345')).toBe('"\'\+12345"');
      expect(sanitizeCsvCell('-500')).toBe('"\'\-500"');
      expect(sanitizeCsvCell('@cmd|/c')).toBe('"\'\@cmd|/c"');
      expect(sanitizeCsvCell('\tmalicious')).toBe('"\'\tmalicious"');
      expect(sanitizeCsvCell('\rmalicious')).toBe('"\'\rmalicious"');
    });

    it('leaves safe alphanumeric content unchanged and properly quoted', () => {
      expect(sanitizeCsvCell('John Doe')).toBe('"John Doe"');
      expect(sanitizeCsvCell('Engineering')).toBe('"Engineering"');
      expect(sanitizeCsvCell('EMP-001')).toBe('"EMP-001"');
      expect(sanitizeCsvCell(12345)).toBe('"12345"');
      expect(sanitizeCsvCell(null)).toBe('""');
      expect(sanitizeCsvCell(undefined)).toBe('""');
    });
  });

  describe('Public Page RPC & Endpoint Contracts', () => {
    const SUPABASE_URL = "https://swlknrfufxsvpkfulqcx.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3bGtucmZ1ZnhzdnBrZnVscWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjQ5NTIsImV4cCI6MjA4OTA0MDk1Mn0.rHNyaxpPkcGOcF3Z_0OKqFGFwDNQ95xao2RGkE9yR-Y";

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    it('allows anonymous execution of get_employee_by_public_id for virtual ID verification', async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_employee_by_public_id`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_public_id: 'PUB-NONEXISTENT' })
      });
      // 200 OK confirms function is executable by anon role without RLS blockage
      expect(res.status).toBe(200);
    });

    it('allows anonymous execution of get_public_booking_page for public meeting bookings', async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_booking_page`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_company_slug: 'demo', p_booking_slug: 'demo' })
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toBeDefined();
    });

    it('allows anonymous execution of get_offer_details_by_token for public candidate offers', async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_offer_details_by_token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_token: 'dummy-token' })
      });
      expect(res.status).toBe(200);
    });

    it('allows anonymous read of public career portal companies and jobs', async () => {
      const resComp = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,name,slug&limit=1`, {
        headers
      });
      expect(resComp.status).toBe(200);

      const resJobs = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=id,title,status&status=eq.open&limit=1`, {
        headers
      });
      expect(resJobs.status).toBe(200);
    });

    it('allows anonymous read of verified global employee records', async () => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/global_employee?select=id,name,verification_link&limit=1`, {
        headers
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });
  });
});
