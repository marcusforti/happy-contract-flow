import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendAllCompletionRequest {
  contractId: string;
  accessToken: string;
  origin: string;
}

// Generate the certificate HTML
function generateCertificateHtml(
  contract: { title: string; description: string | null; document_hash: string | null; created_at: string },
  signatories: Array<{ name: string; email: string; signed_at: string | null }>,
  signatures: Array<{ ip_address: string; user_agent: string; signature_type: string; created_at: string; signatory_id: string }>,
  auditLogs: Array<{ action: string; created_at: string; ip_address: string | null; user_agent: string | null; metadata: any }>
): string {
  const completedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' });
  
  // Map signatures to signatories
  const signatorySignatures = new Map<string, typeof signatures[0]>();
  signatures.forEach(sig => signatorySignatures.set(sig.signatory_id, sig));

  const signatoriesHtml = signatories.map((sig, idx) => {
    const signature = signatures.find(s => s.signatory_id === (sig as any).id);
    const signedAt = sig.signed_at 
      ? new Date(sig.signed_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' })
      : 'N/A';
    
    return `
      <div style="background: #1a1a1a; border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 8px; padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div>
            <span style="color: #D4AF37; font-weight: 600; font-size: 14px;">Signatário ${idx + 1}</span>
            <h3 style="margin: 4px 0 0 0; color: #f2f2f2; font-size: 18px;">${sig.name}</h3>
            <p style="margin: 4px 0 0 0; color: #888; font-size: 13px;">${sig.email}</p>
          </div>
          <span style="background: #166534; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px;">✓ Assinado</span>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div>
            <p style="margin: 0; font-size: 11px; color: #666; text-transform: uppercase;">Data/Hora</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #a0a0a0;">${signedAt}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 11px; color: #666; text-transform: uppercase;">Tipo</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #a0a0a0;">${signature?.signature_type === 'draw' ? '✍️ Desenhada' : '⌨️ Digitada'}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 11px; color: #666; text-transform: uppercase;">Endereço IP</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #a0a0a0; font-family: monospace;">${signature?.ip_address || 'N/A'}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 11px; color: #666; text-transform: uppercase;">Navegador</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #a0a0a0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${signature?.user_agent?.substring(0, 50) || 'N/A'}...</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const auditLogsHtml = auditLogs.map(log => {
    const timestamp = new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
    const actionLabels: Record<string, string> = {
      'contract_created': '📄 Contrato criado',
      'contract_sent': '📤 Contrato enviado',
      'contract_viewed': '👁️ Contrato visualizado',
      'signature_added': '✍️ Assinatura registrada',
      'contract_completed': '✅ Contrato concluído',
    };
    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #888; font-size: 12px;">${timestamp}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #f2f2f2; font-size: 13px;">${actionLabels[log.action] || log.action}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #666; font-size: 11px; font-family: monospace;">${log.ip_address || '-'}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificado de Assinatura - ${contract.title}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body style="margin: 0; padding: 40px; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #f2f2f2;">
  <div style="max-width: 800px; margin: 0 auto; background: #141414; border-radius: 16px; border: 1px solid rgba(212, 175, 55, 0.3); overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%); padding: 32px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.2);">
      <div style="font-size: 48px; margin-bottom: 8px;">📜</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: bold; background: linear-gradient(135deg, #D4AF37, #B8860B); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
        Certificado de Conclusão
      </h1>
      <p style="margin: 8px 0 0 0; color: #888; font-size: 14px;">Documento assinado eletronicamente</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <!-- Document Info -->
      <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Documento</p>
        <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #D4AF37; font-weight: 700;">${contract.title}</h2>
        ${contract.description ? `<p style="margin: 0 0 16px 0; color: #a0a0a0; font-size: 14px;">${contract.description}</p>` : ''}
        <div style="display: flex; gap: 32px; flex-wrap: wrap;">
          <div>
            <p style="margin: 0; font-size: 11px; color: #666; text-transform: uppercase;">Criado em</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #f2f2f2;">${new Date(contract.created_at).toLocaleString('pt-BR', { dateStyle: 'long' })}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 11px; color: #666; text-transform: uppercase;">Concluído em</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #10b981;">${completedAt}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 11px; color: #666; text-transform: uppercase;">Signatários</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #f2f2f2;">${signatories.length} pessoa(s)</p>
          </div>
        </div>
      </div>

      <!-- Signatories -->
      <div style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #D4AF37; display: flex; align-items: center; gap: 8px;">
          <span>✍️</span> Assinaturas Coletadas
        </h3>
        ${signatoriesHtml}
      </div>

      <!-- Document Hash -->
      ${contract.document_hash ? `
      <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 32px; border: 1px solid rgba(255,255,255,0.05);">
        <p style="margin: 0 0 8px 0; font-size: 11px; color: #666; text-transform: uppercase;">Hash SHA-256 do Documento (Integridade)</p>
        <p style="margin: 0; font-size: 11px; color: #888; font-family: 'Courier New', monospace; word-break: break-all;">${contract.document_hash}</p>
      </div>
      ` : ''}

      <!-- Audit Trail -->
      <div style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #D4AF37; display: flex; align-items: center; gap: 8px;">
          <span>📋</span> Trilha de Auditoria
        </h3>
        <div style="background: #1a1a1a; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: rgba(212, 175, 55, 0.1);">
                <th style="padding: 12px; text-align: left; font-size: 11px; color: #888; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.1);">Data/Hora</th>
                <th style="padding: 12px; text-align: left; font-size: 11px; color: #888; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.1);">Ação</th>
                <th style="padding: 12px; text-align: left; font-size: 11px; color: #888; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.1);">IP</th>
              </tr>
            </thead>
            <tbody>
              ${auditLogsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Legal Notice -->
      <div style="background: rgba(212, 175, 55, 0.08); border-left: 4px solid #D4AF37; border-radius: 0 8px 8px 0; padding: 20px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #D4AF37;">⚖️ Validade Jurídica</h4>
        <p style="margin: 0; font-size: 13px; color: #999; line-height: 1.6;">
          Este documento foi assinado eletronicamente em conformidade com a <strong style="color: #D4AF37;">Lei nº 14.063/2020</strong> 
          que estabelece regras e requisitos mínimos para a comunicação digital. A assinatura eletrônica simples utilizada 
          neste documento possui validade jurídica quando associada a dados de identificação do signatário e registros de auditoria, 
          conforme demonstrado neste certificado.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.15); background: #0f0f0f;">
      <p style="margin: 0 0 4px 0; font-size: 14px; color: #D4AF37; font-weight: 600;">⚖️ Regozoni Docs</p>
      <p style="margin: 0; font-size: 11px; color: #666;">
        Certificado gerado automaticamente em ${completedAt}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 10px; color: #444;">
        © 2024 Dr. Sidney Regozoni. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId, accessToken, origin }: SendAllCompletionRequest = await req.json();

    if (!contractId || !accessToken) {
      throw new Error("contractId e accessToken são obrigatórios");
    }

    console.log(`Sending completion emails with certificate to all signatories for contract: ${contractId}`);

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate access token
    const { data: validSignatory, error: validError } = await supabaseAdmin
      .from("contract_signatories")
      .select("id, contract_id")
      .eq("access_token", accessToken)
      .single();

    if (validError || !validSignatory || validSignatory.contract_id !== contractId) {
      throw new Error("Token de acesso inválido");
    }

    // Get contract with full details
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("contracts")
      .select("id, title, description, document_hash, status, created_at")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      throw new Error("Contrato não encontrado");
    }

    if (contract.status !== 'completed') {
      throw new Error("Contrato ainda não foi concluído");
    }

    // Get all signatories with their IDs
    const { data: signatories, error: signError } = await supabaseAdmin
      .from("contract_signatories")
      .select("id, name, email, signed_at")
      .eq("contract_id", contractId)
      .order("signing_order", { ascending: true });

    if (signError || !signatories || signatories.length === 0) {
      throw new Error("Erro ao buscar signatários");
    }

    // Get all signatures with IP and user_agent
    const signatoryIds = signatories.map(s => s.id);
    const { data: signatures, error: signaturesError } = await supabaseAdmin
      .from("signatures")
      .select("id, signatory_id, ip_address, user_agent, signature_type, created_at")
      .in("signatory_id", signatoryIds);

    if (signaturesError) {
      console.error("Error fetching signatures:", signaturesError);
    }

    // Get audit logs
    const { data: auditLogs, error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .select("action, created_at, ip_address, user_agent, metadata")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: true });

    if (auditError) {
      console.error("Error fetching audit logs:", auditError);
    }

    // Generate certificate HTML
    const certificateHtml = generateCertificateHtml(
      contract,
      signatories,
      signatures || [],
      auditLogs || []
    );

    // Convert certificate to base64 for attachment
    const encoder = new TextEncoder();
    const certificateBytes = encoder.encode(certificateHtml);
    const certificateBase64 = btoa(String.fromCharCode(...certificateBytes));

    const completedAt = new Date().toLocaleString('pt-BR', { 
      dateStyle: 'long', 
      timeStyle: 'short' 
    });

    // Format signatories for email
    const signatoriesList = signatories.map(sig => ({
      name: sig.name,
      email: sig.email,
      signedAt: sig.signed_at 
        ? new Date(sig.signed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        : 'N/A'
    }));

    // Generate signatories list HTML for email body
    const signatoriesHtml = signatoriesList.map((sig, idx) => `
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

    // Send email to each signatory with certificate attached
    const emailPromises = signatories.map(signatory => {
      return resend.emails.send({
        from: "Regozoni Docs <noreply@equipe.aceleracaoforti.online>",
        to: [signatory.email],
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
                    
                    <!-- Success Banner -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #166534 0%, #15803d 100%); padding: 24px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 8px;">🎉</div>
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
                          Prezado(a), ${signatory.name}
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
                            ${contract.title}
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

                        <!-- Certificate Download CTA -->
                        <div style="text-align: center; margin: 32px 0;">
                          <p style="margin: 0 0 16px 0; font-size: 14px; color: #a0a0a0;">
                            📎 O certificado completo está anexado a este email
                          </p>
                        </div>

                        ${contract.document_hash ? `
                        <!-- Hash Info -->
                        <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05);">
                          <p style="margin: 0 0 8px 0; font-size: 11px; color: #888; text-transform: uppercase;">Hash SHA-256 do Documento</p>
                          <p style="margin: 0; font-size: 10px; color: #666; font-family: 'Courier New', monospace; word-break: break-all;">${contract.document_hash}</p>
                        </div>
                        ` : ''}

                        <!-- Legal Notice -->
                        <div style="margin-top: 32px; padding: 16px; background: rgba(212, 175, 55, 0.08); border-left: 3px solid #D4AF37; border-radius: 0 8px 8px 0;">
                          <p style="margin: 0; font-size: 12px; color: #999; line-height: 1.6;">
                            <strong style="color: #D4AF37;">⚖️ Validade Jurídica:</strong> Este contrato foi assinado eletronicamente em conformidade com a Lei nº 14.063/2020. A trilha de auditoria completa está disponível no certificado anexo.
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
        attachments: [
          {
            filename: `certificado-${contract.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.html`,
            content: certificateBase64,
          }
        ],
      });
    });

    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Completion emails with certificate sent: ${successCount} success, ${failedCount} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      sent: successCount, 
      failed: failedCount,
      total: signatories.length 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending all completion emails:", error);
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
