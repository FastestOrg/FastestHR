import { Buffer } from "node:buffer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as nodemailer from "npm:nodemailer@6.9.8";

// Polyfill Buffer for nodemailer running in Deno
(globalThis as any).Buffer = Buffer;

function getPublicAppUrl(
  req?: Request,
  company?: {
    custom_domain?: string | null;
    domain_verified?: boolean | null;
    slug?: string | null;
  } | null,
  bodyUrl?: string | null
): string {
  const isLocalOrInternal = (url: string | null | undefined): boolean => {
    if (!url) return true;
    const lower = url.toLowerCase().trim();
    return (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0') ||
      lower.startsWith('capacitor://') ||
      lower.startsWith('ionic://') ||
      lower.startsWith('file://')
    );
  };

  const sanitizeUrl = (url: string): string => {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    return clean;
  };

  if (bodyUrl && !isLocalOrInternal(bodyUrl)) {
    return sanitizeUrl(bodyUrl);
  }

  const origin = req?.headers.get('origin');
  if (origin && !isLocalOrInternal(origin)) {
    return sanitizeUrl(origin);
  }

  const referer = req?.headers.get('referer');
  if (referer && !isLocalOrInternal(referer)) {
    try {
      const refUrl = new URL(referer);
      if (!isLocalOrInternal(refUrl.origin)) {
        return sanitizeUrl(refUrl.origin);
      }
    } catch {
      // ignore
    }
  }

  const envUrl = (globalThis as any).Deno?.env?.get('APP_URL') ||
                 (globalThis as any).Deno?.env?.get('PUBLIC_APP_URL') ||
                 (globalThis as any).Deno?.env?.get('SITE_URL');
  if (envUrl && !isLocalOrInternal(envUrl)) {
    return sanitizeUrl(envUrl);
  }

  if (company?.custom_domain && company?.domain_verified && !isLocalOrInternal(company.custom_domain)) {
    return sanitizeUrl(company.custom_domain);
  }

  return 'https://fastesthr.com';
}

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') || '';
  const isAllowed =
    origin === 'https://fastesthr.com' ||
    origin.endsWith('.fastesthr.com') ||
    origin.endsWith('.vercel.app') ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    origin.startsWith('capacitor://');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://fastesthr.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      candidate_id, 
      job_id, 
      company_id, 
      expectations,
      app_url
    } = await req.json();

    if (!candidate_id || !job_id || !company_id) {
      throw new Error('Missing required fields');
    }

    // 1. Fetch company settings (SMTP etc)
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    if (!company.smtp_host || !company.smtp_user || !company.smtp_pass) {
      throw new Error('SMTP is not configured for this company.');
    }

    // 2. Fetch candidate info
    const { data: candidate, error: candidateError } = await supabaseClient
      .from('candidates')
      .select('full_name, email')
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidate) {
      throw new Error('Candidate not found');
    }

    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .select('title')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // 3. Generate Link Hash and save to ai_interviews
    const linkHash = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2);

    const { data: interview, error: interviewError } = await supabaseClient
      .from('ai_interviews')
      .insert({
        candidate_id,
        job_id,
        link_hash: linkHash,
        expires_at: expiresAt.toISOString(),
        expectations: expectations || [],
        status: 'pending'
      })
      .select()
      .single();

    if (interviewError) {
      throw new Error(`Failed to create interview: ${interviewError.message}`);
    }

    // 4. Send Email
    const appUrl = getPublicAppUrl(req, company, app_url);
    const interviewLink = `${appUrl}/ai-interview/${linkHash}`;

    const transporter = nodemailer.createTransport({
      host: company.smtp_host,
      port: parseInt(company.smtp_port),
      secure: parseInt(company.smtp_port) === 465,
      auth: {
        user: company.smtp_user,
        pass: company.smtp_pass,
      },
    });

    const emailHtml = `
      <div style="font-family: sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1a202c;">AI Interview Invitation</h2>
        <p>Hello ${candidate.full_name},</p>
        <p>Congratulations! You have been shortlisted for an AI Interview for the position of <strong>${job.title}</strong> at <strong>${company.name}</strong>.</p>
        <p>This interview will be conducted by our AI interviewer and will take approximately 10-15 minutes.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${interviewLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Start AI Interview</a>
        </div>
        <p style="color: #718096; font-size: 14px;"><strong>Note:</strong> This link is unique to you and will expire in 48 hours. Please ensure you are in a quiet environment with a stable internet connection.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 12px; color: #a0aec0;">If you didn't expect this email, you can safely ignore it.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${company.smtp_from_name || 'Recruitment Team'}" <${company.smtp_from_email || company.smtp_user}>`,
      to: candidate.email,
      subject: `AI Interview Invitation: ${job.title} at ${company.name}`,
      html: emailHtml,
    });

    return new Response(JSON.stringify({ success: true, interview_id: interview.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Invite Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
