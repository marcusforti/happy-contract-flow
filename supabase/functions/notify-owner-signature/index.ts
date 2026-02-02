import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotifyOwnerRequest {
  contractId: string;
  accessToken: string;
  origin: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId, accessToken, origin }: NotifyOwnerRequest = await req.json();

    if (!contractId || !accessToken) {
      throw new Error("contractId e accessToken são obrigatórios");
    }

    console.log(`Notifying owner for contract: ${contractId}`);

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate access token
    const { data: signatory, error: signatoryError } = await supabaseAdmin
      .from("contract_signatories")
      .select("id, name, email, signed_at")
      .eq("access_token", accessToken)
      .single();

    if (signatoryError || !signatory) {
      throw new Error("Token de acesso inválido");
    }

    // Get contract and owner
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("contracts")
      .select("id, title, owner_id, status")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      throw new Error("Contrato não encontrado");
    }

    // Get owner profile
    const { data: ownerProfile, error: ownerError } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", contract.owner_id)
      .single();

    if (ownerError || !ownerProfile) {
      throw new Error("Perfil do proprietário não encontrado");
    }

    // Get all signatories to show progress
    const { data: allSignatories, error: allSignError } = await supabaseAdmin
      .from("contract_signatories")
      .select("id, name, email, signed_at")
      .eq("contract_id", contractId)
      .order("signing_order", { ascending: true });

    if (allSignError) {
      throw new Error("Erro ao buscar signatários");
    }

    const totalSignatories = allSignatories?.length || 0;
    const signedCount = allSignatories?.filter(s => s.signed_at).length || 0;
    const pendingCount = totalSignatories - signedCount;

    // Format signed date
    const signedAt = signatory.signed_at 
      ? new Date(signatory.signed_at).toLocaleString('pt-BR', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        })
      : new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    // Generate progress bar
    const progressPercent = Math.round((signedCount / totalSignatories) * 100);
    
    // Generate signatories list
    const signatoriesHtml = allSignatories?.map((sig, idx) => {
      const isSigned = !!sig.signed_at;
      const isCurrentSigner = sig.id === signatory.id;
      const signedDate = sig.signed_at 
        ? new Date(sig.signed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : null;
      
      return `
        <tr style="${isCurrentSigner ? 'background: rgba(16, 185, 129, 0.1);' : ''}">
          <td style="padding: 12px 16px; border-bottom: 1px solid rgba(212, 175, 55, 0.1);">
            <span style="color: ${isSigned ? '#10b981' : '#888'}; font-weight: 600;">${idx + 1}.</span>
            <span style="color: #f2f2f2; margin-left: 8px;">${sig.name}</span>
            ${isCurrentSigner ? '<span style="background: #10b981; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">AGORA</span>' : ''}
            <br>
            <span style="color: #888; font-size: 12px;">${sig.email}</span>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid rgba(212, 175, 55, 0.1); text-align: right;">
            ${isSigned 
              ? `<span style="color: #10b981; font-size: 13px;">✓ ${signedDate}</span>` 
              : '<span style="color: #888; font-size: 13px;">Pendente</span>'
            }
          </td>
        </tr>
      `;
    }).join('');

    const contractLink = `${origin}/contracts/${contractId}`;

    const emailResponse = await resend.emails.send({
      from: "Regozoni Docs <noreply@equipe.aceleracaoforti.online>",
      to: [ownerProfile.email],
      subject: `✍️ Nova assinatura: ${signatory.name} assinou "${contract.title}"`,
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
                  
                  <!-- Banner -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1e3a5f 0%, #1e4a7f 100%); padding: 24px; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 8px;">✍️</div>
                      <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #ffffff;">
                        Nova Assinatura Registrada!
                      </h1>
                    </td>
                  </tr>

                  <!-- Header -->
                  <tr>
                    <td style="padding: 24px 40px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
                      <h1 style="margin: 0; font-size: 20px; font-weight: bold; background: linear-gradient(135deg, #D4AF37, #B8860B); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        ⚖️ Regozoni Docs
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #f2f2f2;">
                        Prezado(a), ${ownerProfile.full_name}
                      </h2>
                      <p style="margin: 0 0 24px 0; font-size: 15px; color: #a0a0a0; line-height: 1.7;">
                        Uma nova assinatura foi registrada no seu contrato. Veja os detalhes abaixo:
                      </p>
                      
                      <!-- Contract Info Box -->
                      <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 10px; padding: 24px; margin-bottom: 24px;">
                        <p style="margin: 0 0 8px 0; font-size: 11px; color: #a0a0a0; text-transform: uppercase; letter-spacing: 1px;">
                          Contrato
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 20px; color: #D4AF37; font-weight: 700;">
                          ${contract.title}
                        </p>
                        
                        <!-- Progress Bar -->
                        <div style="margin-bottom: 16px;">
                          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 12px; color: #888;">Progresso</span>
                            <span style="font-size: 12px; color: #D4AF37; font-weight: 600;">${signedCount} de ${totalSignatories}</span>
                          </div>
                          <div style="background: #1a1a1a; border-radius: 4px; height: 8px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #D4AF37, #B8860B); height: 100%; width: ${progressPercent}%; border-radius: 4px;"></div>
                          </div>
                        </div>

                        <div style="background: #1a1a1a; border-radius: 8px; padding: 16px;">
                          <p style="margin: 0 0 4px 0; font-size: 11px; color: #888; text-transform: uppercase;">Quem assinou agora</p>
                          <p style="margin: 0; font-size: 16px; color: #10b981; font-weight: 600;">${signatory.name}</p>
                          <p style="margin: 4px 0 0 0; font-size: 13px; color: #888;">${signatory.email} • ${signedAt}</p>
                        </div>
                      </div>

                      <!-- Signatories Table -->
                      <div style="margin-bottom: 24px;">
                        <p style="margin: 0 0 12px 0; font-size: 13px; color: #a0a0a0; text-transform: uppercase; letter-spacing: 0.5px;">
                          📋 Status das Assinaturas
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0" style="background: #1a1a1a; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.15);">
                          ${signatoriesHtml}
                        </table>
                      </div>

                      ${pendingCount === 0 ? `
                      <!-- All Signed Notice -->
                      <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 20px; margin-bottom: 24px; text-align: center;">
                        <p style="margin: 0; font-size: 16px; color: #10b981; font-weight: 600;">
                          🎉 Todas as assinaturas foram coletadas!
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 13px; color: #888;">
                          O contrato está oficialmente concluído.
                        </p>
                      </div>
                      ` : `
                      <!-- Pending Notice -->
                      <div style="background: rgba(212, 175, 55, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                        <p style="margin: 0; font-size: 14px; color: #D4AF37;">
                          ⏳ Aguardando ${pendingCount} assinatura(s) restante(s)
                        </p>
                      </div>
                      `}
                      
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${contractLink}" 
                               style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #B8860B); color: #0a0a0a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(212, 175, 55, 0.25);">
                              📄 Ver Detalhes do Contrato
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.15); background: #0f0f0f;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">
                        Este é um email automático enviado pela plataforma Regozoni Docs.
                      </p>
                      <p style="margin: 0; font-size: 11px; color: #444;">
                        © 2024 Dr. Sidney Regozoni. Todos os direitos reservados.
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

    console.log("Owner notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending owner notification email:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
