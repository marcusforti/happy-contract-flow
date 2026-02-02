import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  contractId: string;
  accessToken?: string;
  origin?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contractId, accessToken, origin }: RequestBody = await req.json();

    if (!contractId) {
      return new Response(JSON.stringify({ success: false, error: "contractId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Backend não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    }
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    console.log("send-owner-completion-email", { contractId, hasAccessToken: Boolean(accessToken) });

    // Optional: validate access token belongs to this contract (prevents abuse)
    if (accessToken) {
      const { data: tokenRow, error: tokenErr } = await supabase
        .from("contract_signatories")
        .select("id, contract_id, signed_at")
        .eq("access_token", accessToken)
        .maybeSingle();

      if (tokenErr) throw tokenErr;
      if (!tokenRow || tokenRow.contract_id !== contractId) {
        return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: contract, error: contractErr } = await supabase
      .from("contracts")
      .select("id,title,document_hash,owner_id,status")
      .eq("id", contractId)
      .single();

    if (contractErr) throw contractErr;

    if (contract.status !== "completed") {
      return new Response(JSON.stringify({ success: false, error: "Contrato ainda não está concluído" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signatories, error: sigErr } = await supabase
      .from("contract_signatories")
      .select("name,email,signed_at")
      .eq("contract_id", contractId)
      .order("signing_order");

    if (sigErr) throw sigErr;

    const { data: ownerProfile, error: ownerErr } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("user_id", contract.owner_id)
      .single();

    if (ownerErr) throw ownerErr;

    const completedAt = new Date().toISOString();
    const ownerName = ownerProfile.full_name || ownerProfile.email;
    const appOrigin = origin || "";
    const detailsLink = appOrigin ? `${appOrigin}/contracts/${contractId}` : undefined;

    const signatoriesHtml = (signatories || [])
      .map((s, idx) => {
        const signedAt = s.signed_at ? new Date(s.signed_at).toLocaleString("pt-BR") : "N/A";
        return `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid rgba(212, 175, 55, 0.1);">
              <span style="color: #D4AF37; font-weight: 600;">${idx + 1}.</span>
              <span style="color: #f2f2f2; margin-left: 8px;">${s.name}</span>
              <br>
              <span style="color: #888; font-size: 12px;">${s.email}</span>
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid rgba(212, 175, 55, 0.1); text-align: right;">
              <span style="color: #10b981; font-size: 13px;">✓ ${signedAt}</span>
            </td>
          </tr>
        `;
      })
      .join("");

    const emailResponse = await resend.emails.send({
      from: "Regozoni Docs <noreply@equipe.aceleracaoforti.online>",
      to: [ownerProfile.email],
      subject: `✅ Contrato concluído: ${contract.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #141414; border-radius: 12px; border: 1px solid rgba(212, 175, 55, 0.3); overflow: hidden;">
                  <tr>
                    <td style="background: linear-gradient(135deg, #166534 0%, #15803d 100%); padding: 24px; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
                      <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #ffffff;">Contrato Concluído!</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 40px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
                      <h1 style="margin: 0; font-size: 20px; font-weight: bold; background: linear-gradient(135deg, #D4AF37, #B8860B); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">⚖️ Regozoni Docs</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #f2f2f2;">Prezado(a), ${ownerName}</h2>
                      <p style="margin: 0 0 16px 0; font-size: 14px; color: #a0a0a0; line-height: 1.6;">O contrato <strong style="color:#10b981;">foi concluído</strong>. Abaixo está o registro dos signatários.</p>
                      <div style="background: #1a1a1a; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.15); margin: 16px 0 24px;">
                        <table width="100%" cellpadding="0" cellspacing="0">${signatoriesHtml}</table>
                      </div>
                      ${contract.document_hash ? `
                        <p style="margin: 0 0 8px 0; font-size: 11px; color: #888; text-transform: uppercase;">Hash SHA-256</p>
                        <p style="margin: 0 0 24px 0; font-size: 10px; color: #666; font-family: 'Courier New', monospace; word-break: break-all;">${contract.document_hash}</p>
                      ` : ""}
                      ${detailsLink ? `
                        <p style="margin: 0 0 16px 0; font-size: 14px; color: #a0a0a0; line-height: 1.6;">Para baixar o certificado, acesse os detalhes do contrato:</p>
                        <a href="${detailsLink}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #B8860B); color: #0a0a0a; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">📜 Abrir contrato</a>
                      ` : ""}
                      <p style="margin: 24px 0 0 0; font-size: 11px; color: #555;">Concluído em: ${new Date(completedAt).toLocaleString("pt-BR")}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 40px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.15); background: #0f0f0f;">
                      <p style="margin: 0; font-size: 11px; color: #444;">© 2024 Dr. Sidney Regozoni. Todos os direitos reservados.</p>
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

    console.log("Owner completion email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-owner-completion-email error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
