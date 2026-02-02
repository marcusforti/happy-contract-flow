import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SigningEmailRequest {
  to: string;
  signatoryName: string;
  contractTitle: string;
  signingLink: string;
  senderName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, signatoryName, contractTitle, signingLink, senderName }: SigningEmailRequest = await req.json();

    // Validate required fields
    if (!to || !signatoryName || !contractTitle || !signingLink) {
      throw new Error("Campos obrigatórios faltando");
    }

    console.log(`Sending signing email to ${to} for contract: ${contractTitle}`);

    const emailResponse = await resend.emails.send({
      from: "Regozoni Docs <noreply@xn--aceleraoforti-chb.com.br>",
      to: [to],
      subject: `Assinatura solicitada: ${contractTitle}`,
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
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #141414; border-radius: 12px; border: 1px solid rgba(212, 175, 55, 0.2);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 32px 40px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
                      <h1 style="margin: 0; font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #D4AF37, #B8860B); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        ⚖️ Regozoni Docs
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #f2f2f2;">
                        Olá, ${signatoryName}!
                      </h2>
                      <p style="margin: 0 0 24px 0; font-size: 16px; color: #a0a0a0; line-height: 1.6;">
                        ${senderName || 'Alguém'} enviou um documento para você assinar através da plataforma Regozoni Docs.
                      </p>
                      
                      <!-- Contract Info Box -->
                      <div style="background-color: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #a0a0a0; text-transform: uppercase;">
                          Documento
                        </p>
                        <p style="margin: 0; font-size: 18px; color: #D4AF37; font-weight: 600;">
                          ${contractTitle}
                        </p>
                      </div>
                      
                      <p style="margin: 0 0 32px 0; font-size: 14px; color: #a0a0a0; line-height: 1.6;">
                        Clique no botão abaixo para visualizar o documento e realizar sua assinatura digital.
                      </p>
                      
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${signingLink}" 
                               style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #B8860B); color: #0a0a0a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                              Assinar Documento
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 32px 0 0 0; font-size: 12px; color: #666; line-height: 1.6;">
                        Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                        <a href="${signingLink}" style="color: #D4AF37; word-break: break-all;">${signingLink}</a>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.15);">
                      <p style="margin: 0; font-size: 12px; color: #666;">
                        Este é um email automático enviado pela plataforma Regozoni Docs.<br>
                        Sua assinatura digital tem validade jurídica.
                      </p>
                      <p style="margin: 16px 0 0 0; font-size: 11px; color: #444;">
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

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending signing email:", error);
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
