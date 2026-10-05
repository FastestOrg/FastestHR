import { Buffer } from "node:buffer";
import * as nodemailer from "npm:nodemailer@6.9.8";
import { requireCompanyStaff, getCorsHeaders } from "../_shared/auth.ts";

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { employee_id, email, password, company_id, first_name, last_name, app_url } = await req.json();

    if (!employee_id || !email || !password || !company_id || !first_name || !last_name) {
      throw new Error('Missing required fields for portal account creation');
    }

    // 1. Authenticate caller and enforce tenant authorization
    const { adminClient: supabaseClient } = await requireCompanyStaff(req, company_id, [
      'super_admin',
      'company_admin',
      'hr_manager',
    ]);

    // Verify employee belongs to the company
    const { data: empRecord, error: empErr } = await supabaseClient
      .from('employees')
      .select('id, company_id')
      .eq('id', employee_id)
      .single();

    if (empErr || !empRecord || empRecord.company_id !== company_id) {
      throw new Error('Employee not found or does not belong to this company');
    }

    // 2. Fetch company details & SMTP settings
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error(`Company not found: ${companyError?.message}`);
    }

    if (!company.smtp_host || !company.smtp_user || !company.smtp_pass) {
      throw new Error('Company SMTP is not configured. Please set up SMTP in Company Settings > Email & Documents first.');
    }

    // 2. Create user in auth.users
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: { 
        full_name: `${first_name} ${last_name}`,
        platform_role: 'user',
        company_id: company_id
      }
    });

    if (createError) {
      if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
        throw new Error('An account with this email address is already registered in the system.');
      }
      throw createError;
    }

    // 3. Set up SMTP nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: company.smtp_host,
      port: parseInt(company.smtp_port),
      secure: parseInt(company.smtp_port) === 465,
      auth: {
        user: company.smtp_user,
        pass: company.smtp_pass,
      },
    });

    // 4. Construct login link
    const appUrl = getPublicAppUrl(req, company, app_url);
    const loginUrl = `${appUrl}/login`;

    // 5. Construct email body
    const emailHtml = `
      <div style="font-family: sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #7c3aed; margin-top: 0;">Welcome to ${company.name}!</h2>
        <p>Hello ${first_name},</p>
        <p>An employee portal account has been successfully set up for you at <strong>${company.name}</strong>.</p>
        <p>You can now log in to the employee dashboard to view your profile, manage attendance, apply for leaves, and stay updated with announcements.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e293b;">Your Login Credentials:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 100px;">Work Email:</td>
              <td style="padding: 4px 0; font-family: monospace; font-weight: bold; color: #0f172a;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Password:</td>
              <td style="padding: 4px 0; font-family: monospace; font-weight: bold; color: #0f172a;">${password}</td>
            </tr>
          </table>
        </div>
        
        <div style="margin: 32px 0; text-align: center;">
          <a href="${loginUrl}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.1), 0 2px 4px -1px rgba(124, 58, 237, 0.06);">Log In to Your Portal</a>
        </div>
        
        <p style="font-size: 12px; color: #64748b;">For security reasons, we strongly recommend that you change your password after logging in for the first time.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">Sent via FastestHR</p>
      </div>
    `;

    // 6. Send the email
    await transporter.sendMail({
      from: `"${company.smtp_from_name || 'HR Portal'}" <${company.smtp_from_email || company.smtp_user}>`,
      to: email.trim().toLowerCase(),
      subject: `Welcome to ${company.name} - Your Portal Credentials`,
      html: emailHtml,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Create Portal Account Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
