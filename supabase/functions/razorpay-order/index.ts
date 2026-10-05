import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin') || '*';
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
};

function jsonResponse(body: Record<string, unknown>, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { action } = body;

    // ─── CREATE ORDER ──────────────────────────────────────────
    if (action === "create_order") {
      const { amount, currency = "INR", company_id, discount_code } = body;

      if (!amount || amount <= 0) {
        return jsonResponse({ error: "Invalid amount" }, corsHeaders, 400);
      }

      let finalAmount = amount;
      let discountCodeId: string | null = null;
      let discountAmount = 0;

      // Validate discount code if provided
      if (discount_code) {
        const { data: discountData, error: discErr } = await supabase.rpc(
          "validate_discount_code",
          { p_code: discount_code, p_amount: amount }
        );
        if (discErr) {
          return jsonResponse({ error: discErr.message }, corsHeaders, 400);
        }
        if (discountData?.valid) {
          discountAmount = discountData.discount;
          discountCodeId = discountData.code_id;
          finalAmount = Math.max(0, amount - discountAmount);
        } else {
          return jsonResponse({ error: discountData?.error || "Invalid discount code" }, corsHeaders, 400);
        }
      }

      // If finalAmount is 0 after discount, credit directly
      if (finalAmount <= 0) {
        // Full discount — credit wallet directly
        await supabase.rpc("wallet_credit", {
          p_company_id: company_id,
          p_amount: amount,
          p_description: `Wallet top-up ₹${amount} (100% discount: ${discount_code})`,
          p_razorpay_order_id: null,
          p_razorpay_payment_id: null,
          p_created_by: userId,
        });
        if (discountCodeId) {
          await supabase.rpc("apply_discount_code", { p_code_id: discountCodeId });
        }
        return jsonResponse({ success: true, free: true, credited: amount }, corsHeaders);
      }

      // Create Razorpay order
      const keyId = Deno.env.get("RAZORPAY_KEY_ID");
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

      if (!keyId || !keySecret) {
        return jsonResponse({ error: "Razorpay not configured" }, corsHeaders, 500);
      }

      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
        },
        body: JSON.stringify({
          amount: Math.round(finalAmount * 100), // paise
          currency,
          receipt: `w_${company_id.replace(/-/g, '').substring(0, 12)}_${Date.now()}`.substring(0, 40),
          notes: {
            company_id,
            user_id: userId,
            original_amount: amount,
            discount_code: discount_code || "",
            discount_amount: discountAmount,
          },
        }),
      });

      const rzpData = await rzpRes.json();

      if (!rzpRes.ok) {
        return jsonResponse(
          { error: rzpData.error?.description || "Failed to create Razorpay order" },
          corsHeaders,
          400
        );
      }

      // Store pending transaction
      await supabase.from("wallet_transactions").insert({
        company_id,
        amount,
        type: "credit",
        description: `Wallet top-up ₹${amount}${discountAmount > 0 ? ` (discount: ₹${discountAmount})` : ""}`,
        razorpay_order_id: rzpData.id,
        status: "pending",
        created_by: userId,
      });

      return jsonResponse({
        order_id: rzpData.id,
        amount: rzpData.amount,
        currency: rzpData.currency,
        key_id: keyId,
        discount_code_id: discountCodeId,
        discount_amount: discountAmount,
        original_amount: amount,
      }, corsHeaders);
    }

    // ─── VERIFY PAYMENT ────────────────────────────────────────
    if (action === "verify_payment") {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        company_id,
        discount_code_id,
      } = body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !company_id) {
        return jsonResponse({ error: "Missing payment details or company_id" }, corsHeaders, 400);
      }

      // Check tenant isolation: ensure caller belongs to company_id or is super_admin
      const { data: callerProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("company_id, platform_role")
        .eq("id", userId)
        .single();

      if (profileErr || !callerProfile) {
        return jsonResponse({ error: "Caller profile not found" }, corsHeaders, 403);
      }

      if (callerProfile.platform_role !== "super_admin" && callerProfile.company_id !== company_id) {
        return jsonResponse({ error: "Forbidden: You cannot verify payments for another company" }, corsHeaders, 403);
      }

      // 1. Fetch the pending transaction from DB to get the authorized amount
      const { data: pendingTx, error: txErr } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("razorpay_order_id", razorpay_order_id)
        .eq("company_id", company_id)
        .maybeSingle();

      if (txErr || !pendingTx) {
        return jsonResponse({ error: "Order record not found for this transaction" }, corsHeaders, 404);
      }

      // Idempotency: if already completed, return success
      if (pendingTx.status === "completed") {
        return jsonResponse({ success: true, credited: pendingTx.amount, message: "Payment already verified" }, corsHeaders);
      }

      // 2. Verify signature using HMAC-SHA256
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
      if (!keySecret) {
        return jsonResponse({ error: "Razorpay secret key not configured" }, corsHeaders, 500);
      }

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(keySecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`)
      );
      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (expectedSignature !== razorpay_signature) {
        // Mark transaction as failed
        await supabase
          .from("wallet_transactions")
          .update({ status: "failed" })
          .eq("razorpay_order_id", razorpay_order_id);

        return jsonResponse({ error: "Invalid payment signature" }, corsHeaders, 400);
      }

      // 3. Reconcile with Razorpay API if keyId and keySecret are present
      const keyId = Deno.env.get("RAZORPAY_KEY_ID");
      if (keyId && keySecret) {
        try {
          const rzpPaymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
            headers: {
              Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
            },
          });
          if (rzpPaymentRes.ok) {
            const paymentData = await rzpPaymentRes.json();
            if (paymentData.order_id && paymentData.order_id !== razorpay_order_id) {
              return jsonResponse({ error: "Payment does not match order ID" }, corsHeaders, 400);
            }
          }
        } catch (apiErr) {
          console.warn("Razorpay API payment fetch notice:", apiErr);
        }
      }

      // 4. Securely credit wallet with authorized amount from DB (NEVER client body original_amount)
      const creditAmount = Number(pendingTx.amount);
      if (creditAmount > 0) {
        // Use RPC for atomic wallet credit
        const { error: creditErr } = await supabase.rpc("wallet_credit", {
          p_company_id: company_id,
          p_amount: creditAmount,
          p_description: `Razorpay payment verified: ₹${creditAmount}`,
          p_razorpay_order_id: razorpay_order_id,
          p_razorpay_payment_id: razorpay_payment_id,
          p_created_by: userId,
        });

        if (creditErr) {
          console.error("wallet_credit error:", creditErr);
          return jsonResponse({ error: "Failed to credit wallet: " + creditErr.message }, corsHeaders, 500);
        }

        // Update pending transaction status to completed
        await supabase
          .from("wallet_transactions")
          .update({
            status: "completed",
            razorpay_payment_id,
          })
          .eq("razorpay_order_id", razorpay_order_id);

        // Apply discount code usage if applicable
        if (discount_code_id) {
          await supabase.rpc("apply_discount_code", { p_code_id: discount_code_id });
        }
      }

      return jsonResponse({ success: true, credited: creditAmount }, corsHeaders);
    }

    return jsonResponse({ error: "Invalid action" }, corsHeaders, 400);
  } catch (err: any) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, getCorsHeaders(req), 500);
  }
});
