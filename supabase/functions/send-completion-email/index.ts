import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CompletionEmailRequest {
  to: string;
  recipientName: string;
  contractTitle: string;
  completedAt: string;
  signatories: Array<{ name: string; email: string; signedAt: string }>;
  certificateLink?: string;
  documentHash?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      recipientName, 
      contractTitle, 
      completedAt,
      signatories,
      certificateLink,
      documentHash
    }: CompletionEmailRequest = await req.json();

    if (!to || !recipientName || !contractTitle || !completedAt) {
      throw new Error("Campos obrigatórios faltando");
    }

    console.log(`Sending completion email to ${to} for contract: ${contractTitle}`);

    // Generate signatories list HTML
    const signatoriesHtml = signatories.map((sig, idx) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(212, 175, 55, 0.1);">
          <span style="color: #D4AF37; font-weight: 600;">${idx + 1}.</span>
          <span style="color: #f2f2f2; margin-left: 8px;">${sig.name}</span>
          <br>
          <span style="color: #888; font-size: 12px;">${sig.email}</span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(212, 175, 55, 0.1); text-align: right;">
          <span style="color: #10b981; font-size: 13px;">✓ ${sig.signedAt}</span>
        </td>
      </tr>
    `).join('');

    const emailResponse = await resend.emails.send({
      from: "Regozoni Docs <noreply@xn--aceleraoforti-chb.com.br>",
      to: [to],
      subject: `✅ Contrato concluído: ${contractTitle}`,
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
                  
                  <!-- Success Banner -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #166534 0%, #15803d 100%); padding: 24px; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
                      <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: #ffffff;">
                        Contrato Concluído com Sucesso!
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
                        Prezado(a), ${recipientName}
                      </h2>
                      <p style="margin: 0 0 24px 0; font-size: 15px; color: #a0a0a0; line-height: 1.7;">
                        Temos o prazer de informar que o contrato abaixo foi <strong style="color: #10b981;">assinado por todas as partes</strong> e está oficialmente concluído. Todas as assinaturas foram coletadas com sucesso através da plataforma Regozoni Docs.
                      </p>
                      
                      <!-- Contract Info Box -->
                      <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 10px; padding: 24px; margin-bottom: 24px;">
                        <p style="margin: 0 0 8px 0; font-size: 11px; color: #a0a0a0; text-transform: uppercase; letter-spacing: 1px;">
                          Documento
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 20px; color: #D4AF37; font-weight: 700;">
                          ${contractTitle}
                        </p>
                        <div style="display: flex; gap: 24px;">
                          <div>
                            <p style="margin: 0; font-size: 11px; color: #888; text-transform: uppercase;">Concluído em</p>
                            <p style="margin: 4px 0 0 0; font-size: 14px; color: #f2f2f2;">${completedAt}</p>
                          </div>
                          <div>
                            <p style="margin: 0; font-size: 11px; color: #888; text-transform: uppercase;">Signatários</p>
                            <p style="margin: 4px 0 0 0; font-size: 14px; color: #f2f2f2;">${signatories.length} pessoa(s)</p>
                          </div>
                        </div>
                      </div>

                      <!-- Signatories Table -->
                      <div style="margin-bottom: 24px;">
                        <p style="margin: 0 0 12px 0; font-size: 13px; color: #a0a0a0; text-transform: uppercase; letter-spacing: 0.5px;">
                          ✍️ Assinaturas Coletadas
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0" style="background: #1a1a1a; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.15);">
                          ${signatoriesHtml}
                        </table>
                      </div>

                      ${documentHash ? `
                      <!-- Hash Info -->
                      <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
                        <p style="margin: 0 0 8px 0; font-size: 11px; color: #888; text-transform: uppercase;">Hash SHA-256 do Documento</p>
                        <p style="margin: 0; font-size: 10px; color: #666; font-family: 'Courier New', monospace; word-break: break-all;">${documentHash}</p>
                      </div>
                      ` : ''}

                      <p style="margin: 0 0 24px 0; font-size: 14px; color: #a0a0a0; line-height: 1.6;">
                        ${certificateLink 
                          ? 'Você pode baixar o certificado de conclusão clicando no botão abaixo. Este documento comprova a validade jurídica das assinaturas eletrônicas.' 
                          : 'Acesse a plataforma Regozoni Docs para visualizar os detalhes completos e baixar o certificado de conclusão.'
                        }
                      </p>
                      
                      <!-- CTA Button -->
                      ${certificateLink ? `
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${certificateLink}" 
                               style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #B8860B); color: #0a0a0a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(212, 175, 55, 0.25);">
                              📜 Ver Contrato Concluído
                            </a>
                          </td>
                        </tr>
                      </table>
                      ` : ''}

                      <!-- Legal Notice -->
                      <div style="margin-top: 32px; padding: 16px; background: rgba(212, 175, 55, 0.08); border-left: 3px solid #D4AF37; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0; font-size: 12px; color: #999; line-height: 1.6;">
                          <strong style="color: #D4AF37;">⚖️ Validade Jurídica:</strong> Este contrato foi assinado eletronicamente em conformidade com a Lei nº 14.063/2020. A trilha de auditoria completa está disponível para verificação.
                        </p>
                      </div>
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

    console.log("Completion email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending completion email:", error);
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
