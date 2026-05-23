import { Buffer } from "node:buffer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as nodemailer from "npm:nodemailer@6.9.8";

// Polyfill Buffer for nodemailer running in Deno
(globalThis as any).Buffer = Buffer;

const allowedOrigins = [
  'https://fastesthr.com',
  'http://localhost:8080',
  'http://localhost:5173'
];

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin');
  let isAllowed = false;
  
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      isAllowed = true;
    } else if (origin.endsWith('.fastesthr.com')) {
      isAllowed = true;
    }
  }

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
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

    const { offer_id, candidate_email, token } = await req.json();

    if (!offer_id || !candidate_email) {
      throw new Error('Missing required fields');
    }

    // 1. Fetch offer and company details
    const { data: offer, error: offerError } = await supabaseClient
      .from('candidate_offers')
      .select('*, companies(*), candidates(full_name), jobs(title)')
      .eq('id', offer_id)
      .single();

    if (offerError || !offer) {
      throw new Error('Offer not found');
    }

    const company = offer.companies;

    // 2. Ensure user exists in auth.users
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: candidate_email,
      email_confirm: true,
      user_metadata: { 
        full_name: offer.candidates?.full_name,
        platform_role: 'candidate'
      }
    });

    if (createError && !createError.message.includes('already registered')) {
      throw createError;
    }

    // 3. Generate Magic Link
    const origin = req.headers.get('origin') || 'http://localhost:8080';
    const redirectTo = `${origin}/offer/${token}`;
    
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: candidate_email,
      options: { redirectTo }
    });

    if (linkError) throw linkError;

    const magicLink = linkData.properties.action_link;

    // 4. Send Email via Company SMTP if configured, else throw (or fallback)
    if (!company.smtp_host || !company.smtp_user || !company.smtp_pass) {
      throw new Error('Company SMTP is not configured. Please contact the hiring team.');
    }

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
        <h2 style="color: #7c3aed;">Confirm Your Acceptance</h2>
        <p>Hello ${offer.candidates?.full_name.split(' ')[0]},</p>
        <p>You have signed the offer letter for <strong>${offer.jobs?.title}</strong> at <strong>${company.name}</strong>.</p>
        <p>To finalize your acceptance and verify your identity, please click the secure button below:</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${magicLink}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Confirm & Finalize Acceptance</a>
        </div>
        <p style="font-size: 12px; color: #64748b;">This link will expire in 24 hours. After clicking, you will be redirected back to your offer portal where you can download the signed copy.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Sent via FastestHR Autonomous Recruitment System</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${company.smtp_from_name || 'HR'}" <${company.smtp_from_email || company.smtp_user}>`,
      to: candidate_email,
      subject: `Confirm Offer Acceptance: ${offer.jobs?.title} - ${company.name}`,
      html: emailHtml,
    });

    // 5. Update offer status to 'accepted' (meaning candidate has acknowledged and is in process of signing)
    await supabaseClient
      .from('candidate_offers')
      .update({ status: 'accepted' })
      .eq('id', offer_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Magic Link Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
