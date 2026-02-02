import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessToken, otp } = await req.json();

    if (!accessToken || !otp) {
      throw new Error("Token de acesso e código OTP são obrigatórios");
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client info from headers
    const forwardedFor = req.headers.get("x-forwarded-for");
    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    const clientIp = cfConnectingIp || (forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown");
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Get signatory by access token
    const { data: signatory, error: signatoryError } = await supabase
      .from("contract_signatories")
      .select("id, name, email, contract_id, otp_code, otp_expires_at, otp_verified_at")
      .eq("access_token", accessToken)
      .single();

    if (signatoryError || !signatory) {
      throw new Error("Signatário não encontrado");
    }

    // Check if already verified
    if (signatory.otp_verified_at) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email já verificado",
          alreadyVerified: true 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if OTP exists
    if (!signatory.otp_code) {
      throw new Error("Código não encontrado. Solicite um novo código.");
    }

    // Check if OTP is expired
    if (new Date(signatory.otp_expires_at) < new Date()) {
      // Clear expired OTP
      await supabase
        .from("contract_signatories")
        .update({ otp_code: null, otp_expires_at: null })
        .eq("id", signatory.id);
      
      throw new Error("Código expirado. Solicite um novo código.");
    }

    // Verify OTP (case-insensitive, trim spaces)
    const normalizedInput = otp.toString().trim();
    const normalizedStored = signatory.otp_code.toString().trim();

    if (normalizedInput !== normalizedStored) {
      // Log failed attempt
      await supabase.from("audit_logs").insert({
        contract_id: signatory.contract_id,
        signatory_id: signatory.id,
        action: "otp_failed",
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: { attempt: normalizedInput.slice(0, 2) + "****" },
      });

      throw new Error("Código inválido. Verifique e tente novamente.");
    }

    // Mark as verified and clear OTP
    const verifiedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("contract_signatories")
      .update({
        otp_verified_at: verifiedAt,
        otp_code: null,
        otp_expires_at: null,
      })
      .eq("id", signatory.id);

    if (updateError) {
      throw new Error("Erro ao verificar código");
    }

    // Log successful verification
    await supabase.from("audit_logs").insert({
      contract_id: signatory.contract_id,
      signatory_id: signatory.id,
      action: "otp_verified",
      ip_address: clientIp,
      user_agent: userAgent,
      metadata: { verified_at: verifiedAt },
    });

    console.log(`OTP verified for ${signatory.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email verificado com sucesso!",
        verifiedAt 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
