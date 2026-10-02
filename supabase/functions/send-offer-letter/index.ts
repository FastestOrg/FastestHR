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
      offer_data,
      html_content,
      pdf_path,
      offer_number,
      template_id,
      is_predefined_html,
      app_url
    } = await req.json();

    if (!candidate_id || !job_id || !company_id || !pdf_path || !html_content) {
      throw new Error('Missing required fields');
    }

    // 1. Fetch company settings
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error(`Company not found: ${companyError?.message}`);
    }

    if (!company.smtp_host || !company.smtp_user || !company.smtp_pass) {
      throw new Error(`SMTP is not configured for this company. Please set it up in Company Settings.`);
    }

    // 2. Fetch candidate & job for email
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

    // 3. Save to candidate_offers
    const { data: savedOffer, error: saveError } = await supabaseClient
      .from('candidate_offers')
      .insert({
        company_id,
        candidate_id,
        job_id,
        template_id: template_id || null,
        offer_number: offer_number,
        joining_date: offer_data?.joiningDate,
        payout: offer_data?.payout,
        custom_variable_values: offer_data?.custom_variable_values || {},
        html_content: html_content,
        pdf_url: pdf_path,
        is_predefined_html: is_predefined_html || false
      })
      .select()
      .single();

    if (saveError) {
      throw new Error(`Failed to save offer: ${saveError.message}`);
    }

    // 4. Download PDF from Storage to attach
    console.log(`Downloading PDF from offer_letters bucket: ${pdf_path}`);
    const { data: pdfBlob, error: downloadError } = await supabaseClient
      .storage
      .from('offer_letters')
      .download(pdf_path);

    if (downloadError || !pdfBlob) {
      throw new Error(`Failed to download PDF attachment: ${downloadError?.message}`);
    }
    const pdfBuffer = await pdfBlob.arrayBuffer();

    // 4.5 Fetch template for email subject/body
    let templateEmailSubject: string | null = null;
    let templateEmailBody: string | null = null;
    if (template_id) {
      const { data: tmpl } = await supabaseClient
        .from('offer_templates')
        .select('email_subject, email_body')
        .eq('id', template_id)
        .single();
      if (tmpl) {
        templateEmailSubject = tmpl.email_subject;
        templateEmailBody = tmpl.email_body;
      }
    }

    const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const payoutNum = typeof offer_data?.payout === 'string' 
      ? parseFloat(offer_data.payout.replace(/[^0-9.-]+/g, "")) 
      : offer_data?.payout;
    
    const formattedPayout = (payoutNum || 0).toLocaleString('en-US', { 
      style: 'currency', 
      currency: company.currency || 'USD' 
    });
    
    const appUrl = getPublicAppUrl(req, company, app_url);
    const publicUrl = `${appUrl}/offer/${savedOffer.token}`;

    const formatDateString = (dateStr: string) => {
      if (!dateStr) return '';
      const parts = dateStr.trim().split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      return dateStr;
    };
    
    const formattedJoiningDate = formatDateString(offer_data?.joiningDate);

    // Replace variables in template subject/body
    const replaceVars = (text: string) => {
      let result = text
        // Unified variants (Case-insensitive)
        .replace(/\{\{Name\}\}/gi, candidate.full_name)
        .replace(/\{\{Designation\}\}/gi, job.title)
        .replace(/\{\{Offer Number\}\}/gi, offer_number || '')
        .replace(/\{\{Joined Date\}\}/gi, formattedJoiningDate || '')
        .replace(/\{\{Payout\}\}/gi, formattedPayout || '')
        .replace(/\{\{Offer Link\}\}/gi, publicUrl)
        .replace(/\{\{Today\}\}/gi, formattedDate)
        // Legacy variants
        .replace(/\{\{candidate_name\}\}/gi, candidate.full_name)
        .replace(/\{\{job_title\}\}/gi, job.title)
        .replace(/\{\{offer_number\}\}/gi, offer_number || '')
        .replace(/\{\{offer_link\}\}/gi, publicUrl)
        .replace(/\{\{first_name\}\}/gi, candidate.full_name.split(' ')[0]);

      // Replace custom variables
      if (offer_data?.custom_variable_values) {
        for (const [key, value] of Object.entries(offer_data.custom_variable_values)) {
          // Escape special regex characters in the key
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const customRegex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi');
          result = result.replace(customRegex, value as string);
        }
      }
      return result;
    };

    const emailSubject = templateEmailSubject 
      ? replaceVars(templateEmailSubject)
      : `Offer of Employment - ${job.title}`;

    let emailHtml: string;
    if (templateEmailBody) {
      // Convert plain text body to HTML (preserve newlines)
      const bodyHtml = replaceVars(templateEmailBody)
        .split('\n')
        .map((line: string) => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0">${line}</p>`)
        .join('\n');
      emailHtml = `<div style="font-family: sans-serif; line-height: 1.6;">${bodyHtml}</div>`;
    } else {
      emailHtml = `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>Congratulations ${candidate.full_name.split(' ')[0]}!</h2>
          <p>We are excited to offer you the position of <strong>${job.title}</strong> at ${company.name}.</p>
          <p>Please find your official offer letter attached to this email as a PDF document.</p>
          <p>You can also view and accept your offer online by clicking the button below:</p>
          <div style="margin: 2rem 0;">
            <a href="${publicUrl}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Offer Online</a>
          </div>
          <p>If you have any questions, feel free to reply to this email.</p>
          <p>Best regards,<br/>The Hiring Team</p>
        </div>
      `;
    }

    // 6. Send Email using nodemailer
    const transporter = nodemailer.createTransport({
      host: company.smtp_host,
      port: parseInt(company.smtp_port),
      secure: parseInt(company.smtp_port) === 465,
      auth: {
        user: company.smtp_user,
        pass: company.smtp_pass,
      },
    });

    await transporter.sendMail({
      from: `"${company.smtp_from_name || 'HR'}" <${company.smtp_from_email || company.smtp_user}>`,
      to: candidate.email,
      subject: emailSubject,
      html: emailHtml,
      attachments: [
        {
          filename: `Offer-${candidate.full_name.replace(/\s+/g, '-')}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ]
    });


    return new Response(JSON.stringify({ success: true, offer_id: savedOffer.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Offer Letter Error:', error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
