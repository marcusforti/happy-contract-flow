import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessToken } = await req.json();

    if (!accessToken) {
      throw new Error("Token de acesso é obrigatório");
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get signatory by access token
    const { data: signatory, error: signatoryError } = await supabase
      .from("contract_signatories")
      .select("id, name, email, contract_id, otp_verified_at")
      .eq("access_token", accessToken)
      .single();

    if (signatoryError || !signatory) {
      throw new Error("Signatário não encontrado");
    }

    // If already verified, return success
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

    // Get contract title
    const { data: contract } = await supabase
      .from("contracts")
      .select("title")
      .eq("id", signatory.contract_id)
      .single();

    // Generate OTP and set expiration (10 minutes)
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store OTP (in production, store hashed version)
    const { error: updateError } = await supabase
      .from("contract_signatories")
      .update({
        otp_code: otp,
        otp_expires_at: expiresAt,
      })
      .eq("id", signatory.id);

    if (updateError) {
      console.error("Error storing OTP:", updateError);
      throw new Error("Erro ao gerar código de verificação");
    }

    // Send OTP email
    const emailResponse = await resend.emails.send({
      from: "Regozoni Docs <equipe@equipe.aceleracaoforti.online>",
      to: [signatory.email],
      subject: `Código de Verificação - ${contract?.title || "Documento"}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" style="max-width: 500px; background: linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%); border-radius: 16px; border: 1px solid #c9a227; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #c9a227 0%, #a17f1a 100%); padding: 24px; text-align: center;">
                      <h1 style="margin: 0; color: #0a0a0a; font-size: 24px; font-weight: 700;">⚖️ Regozoni Docs</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                      <p style="color: #ffffff; font-size: 16px; margin: 0 0 8px 0;">Olá, <strong>${signatory.name}</strong></p>
                      <p style="color: #a1a1a1; font-size: 14px; margin: 0 0 32px 0;">
                        Para acessar o documento <strong style="color: #c9a227;">"${contract?.title || "Documento"}"</strong>, insira o código de verificação abaixo:
                      </p>
                      
                      <!-- OTP Code -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 24px 0;">
                            <div style="display: inline-block; background: #1f1f1f; border: 2px solid #c9a227; border-radius: 12px; padding: 20px 40px;">
                              <span style="font-size: 36px; font-weight: 700; color: #c9a227; letter-spacing: 8px; font-family: monospace;">${otp}</span>
                            </div>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0 0; text-align: center;">
                        ⏱️ Este código expira em <strong style="color: #c9a227;">10 minutos</strong>
                      </p>
                      
                      <hr style="border: none; border-top: 1px solid #333; margin: 32px 0;">
                      
                      <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                        Se você não solicitou este código, ignore este email.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background: #0d0d0d; padding: 20px; text-align: center; border-top: 1px solid #222;">
                      <p style="color: #666; font-size: 11px; margin: 0;">
                        Regozoni Docs - Assessoria Jurídica<br>
                        Dr. Sidney Regozoni
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("OTP email sent:", emailResponse);

    // Log the OTP sent event
    await supabase.from("audit_logs").insert({
      contract_id: signatory.contract_id,
      signatory_id: signatory.id,
      action: "otp_sent",
      metadata: { email: signatory.email },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Código enviado para " + signatory.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
        expiresAt 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
