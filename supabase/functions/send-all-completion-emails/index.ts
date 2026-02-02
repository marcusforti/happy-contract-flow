import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

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

// Generate PDF certificate
function generateCertificatePdf(
  contract: { title: string; description: string | null; document_hash: string | null; created_at: string },
  signatories: Array<{ id: string; name: string; email: string; signed_at: string | null }>,
  signatures: Array<{ ip_address: string; user_agent: string; signature_type: string; created_at: string; signatory_id: string }>,
  auditLogs: Array<{ action: string; created_at: string; ip_address: string | null; user_agent: string | null; metadata: any }>
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Colors
  const goldColor = [212, 175, 55] as [number, number, number];
  const darkBg = [20, 20, 20] as [number, number, number];
  const textWhite = [242, 242, 242] as [number, number, number];
  const textGray = [160, 160, 160] as [number, number, number];
  const textDarkGray = [136, 136, 136] as [number, number, number];
  const greenColor = [16, 185, 129] as [number, number, number];

  // Background
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Main container background
  doc.setFillColor(...darkBg);
  doc.roundedRect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, 3, 3, 'F');

  // Gold border
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, 3, 3, 'S');

  // Header with gradient effect (simplified as solid color)
  doc.setFillColor(30, 28, 20);
  doc.roundedRect(margin, yPos, contentWidth, 35, 2, 2, 'F');

  // Certificate icon (emoji replacement with text)
  doc.setFontSize(24);
  doc.setTextColor(...goldColor);
  doc.text('📜', pageWidth / 2, yPos + 12, { align: 'center' });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...goldColor);
  doc.text('CERTIFICADO DE CONCLUSÃO', pageWidth / 2, yPos + 22, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(...textDarkGray);
  doc.text('Documento assinado eletronicamente', pageWidth / 2, yPos + 30, { align: 'center' });

  yPos += 45;

  // Document Info Section
  doc.setFillColor(25, 23, 18);
  doc.roundedRect(margin, yPos, contentWidth, 45, 2, 2, 'F');
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, contentWidth, 45, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setTextColor(...textDarkGray);
  doc.text('DOCUMENTO', margin + 5, yPos + 8);

  doc.setFontSize(14);
  doc.setTextColor(...goldColor);
  const titleLines = doc.splitTextToSize(contract.title, contentWidth - 10);
  doc.text(titleLines, margin + 5, yPos + 16);

  const titleHeight = titleLines.length * 5;

  if (contract.description) {
    doc.setFontSize(9);
    doc.setTextColor(...textGray);
    const descLines = doc.splitTextToSize(contract.description, contentWidth - 10);
    doc.text(descLines.slice(0, 2), margin + 5, yPos + titleHeight + 14);
  }

  const createdAt = new Date(contract.created_at).toLocaleDateString('pt-BR', { dateStyle: 'long' });
  const completedAt = new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' });

  doc.setFontSize(7);
  doc.setTextColor(...textDarkGray);
  doc.text('CRIADO EM', margin + 5, yPos + 35);
  doc.setTextColor(...textWhite);
  doc.setFontSize(8);
  doc.text(createdAt, margin + 5, yPos + 40);

  doc.setFontSize(7);
  doc.setTextColor(...textDarkGray);
  doc.text('CONCLUÍDO EM', margin + 60, yPos + 35);
  doc.setTextColor(...greenColor);
  doc.setFontSize(8);
  doc.text(completedAt, margin + 60, yPos + 40);

  doc.setFontSize(7);
  doc.setTextColor(...textDarkGray);
  doc.text('SIGNATÁRIOS', margin + 120, yPos + 35);
  doc.setTextColor(...textWhite);
  doc.setFontSize(8);
  doc.text(`${signatories.length} pessoa(s)`, margin + 120, yPos + 40);

  yPos += 55;

  // Signatories Section
  doc.setFontSize(10);
  doc.setTextColor(...goldColor);
  doc.text('✍️ ASSINATURAS COLETADAS', margin, yPos);
  yPos += 8;

  signatories.forEach((sig, idx) => {
    const signature = signatures.find(s => s.signatory_id === sig.id);
    const signedAt = sig.signed_at
      ? new Date(sig.signed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : 'N/A';

    // Check if we need a new page
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
      // Add background to new page
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFillColor(...darkBg);
      doc.roundedRect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, 3, 3, 'F');
    }

    // Signatory box
    doc.setFillColor(26, 26, 26);
    doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'F');

    // Signatory number
    doc.setFontSize(8);
    doc.setTextColor(...goldColor);
    doc.text(`Signatário ${idx + 1}`, margin + 4, yPos + 6);

    // Status badge
    doc.setFillColor(22, 101, 52);
    doc.roundedRect(margin + contentWidth - 25, yPos + 2, 22, 6, 1, 1, 'F');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text('✓ Assinado', margin + contentWidth - 24, yPos + 6);

    // Name and email
    doc.setFontSize(11);
    doc.setTextColor(...textWhite);
    doc.text(sig.name, margin + 4, yPos + 13);

    doc.setFontSize(8);
    doc.setTextColor(...textDarkGray);
    doc.text(sig.email, margin + 4, yPos + 18);

    // Signature details
    doc.setFontSize(6);
    doc.setTextColor(...textDarkGray);
    doc.text('DATA/HORA', margin + 4, yPos + 23);
    doc.text('TIPO', margin + 45, yPos + 23);
    doc.text('IP', margin + 80, yPos + 23);

    doc.setFontSize(7);
    doc.setTextColor(...textGray);
    doc.text(signedAt, margin + 4, yPos + 27);
    doc.text(signature?.signature_type === 'draw' ? 'Desenhada' : 'Digitada', margin + 45, yPos + 27);
    doc.text(signature?.ip_address || 'N/A', margin + 80, yPos + 27);

    yPos += 32;
  });

  yPos += 5;

  // Document Hash
  if (contract.document_hash) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFillColor(...darkBg);
      doc.roundedRect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, 3, 3, 'F');
    }

    doc.setFillColor(26, 26, 26);
    doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F');

    doc.setFontSize(7);
    doc.setTextColor(...textDarkGray);
    doc.text('HASH SHA-256 DO DOCUMENTO (INTEGRIDADE)', margin + 4, yPos + 6);

    doc.setFontSize(5);
    doc.setTextColor(...textGray);
    const hashLines = doc.splitTextToSize(contract.document_hash, contentWidth - 8);
    doc.text(hashLines, margin + 4, yPos + 12);

    yPos += 23;
  }

  // Audit Trail
  if (auditLogs && auditLogs.length > 0) {
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = margin;
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFillColor(...darkBg);
      doc.roundedRect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, 3, 3, 'F');
    }

    doc.setFontSize(10);
    doc.setTextColor(...goldColor);
    doc.text('📋 TRILHA DE AUDITORIA', margin, yPos);
    yPos += 6;

    const actionLabels: Record<string, string> = {
      'contract_created': 'Contrato criado',
      'contract_sent': 'Contrato enviado',
      'contract_viewed': 'Contrato visualizado',
      'signature_added': 'Assinatura registrada',
      'contract_completed': 'Contrato concluído',
    };

    // Table header
    doc.setFillColor(30, 28, 20);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
    doc.setFontSize(6);
    doc.setTextColor(...textDarkGray);
    doc.text('DATA/HORA', margin + 4, yPos + 5);
    doc.text('AÇÃO', margin + 50, yPos + 5);
    doc.text('IP', margin + 130, yPos + 5);
    yPos += 9;

    auditLogs.slice(0, 10).forEach((log) => {
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = margin;
        doc.setFillColor(10, 10, 10);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setFillColor(...darkBg);
        doc.roundedRect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, 3, 3, 'F');
      }

      const timestamp = new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

      doc.setFillColor(26, 26, 26);
      doc.rect(margin, yPos, contentWidth, 7, 'F');

      doc.setFontSize(6);
      doc.setTextColor(...textDarkGray);
      doc.text(timestamp, margin + 4, yPos + 5);

      doc.setTextColor(...textWhite);
      doc.text(actionLabels[log.action] || log.action, margin + 50, yPos + 5);

      doc.setTextColor(...textDarkGray);
      doc.text(log.ip_address || '-', margin + 130, yPos + 5);

      yPos += 8;
    });

    yPos += 5;
  }

  // Legal Notice
  if (yPos > pageHeight - 35) {
    doc.addPage();
    yPos = margin;
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(...darkBg);
    doc.roundedRect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10, 3, 3, 'F');
  }

  doc.setFillColor(25, 23, 15);
  doc.roundedRect(margin, yPos, contentWidth, 25, 2, 2, 'F');

  // Gold left border
  doc.setFillColor(...goldColor);
  doc.rect(margin, yPos, 2, 25, 'F');

  doc.setFontSize(9);
  doc.setTextColor(...goldColor);
  doc.text('⚖️ Validade Jurídica', margin + 6, yPos + 7);

  doc.setFontSize(7);
  doc.setTextColor(...textGray);
  const legalText = 'Este documento foi assinado eletronicamente em conformidade com a Lei nº 14.063/2020 que estabelece regras e requisitos mínimos para a comunicação digital. A assinatura eletrônica simples utilizada neste documento possui validade jurídica quando associada a dados de identificação do signatário e registros de auditoria.';
  const legalLines = doc.splitTextToSize(legalText, contentWidth - 12);
  doc.text(legalLines, margin + 6, yPos + 13);

  yPos += 30;

  // Footer
  doc.setFillColor(15, 15, 15);
  doc.rect(margin, pageHeight - margin - 15, contentWidth, 15, 'F');

  doc.setFontSize(10);
  doc.setTextColor(...goldColor);
  doc.text('⚖️ Regozoni Docs', pageWidth / 2, pageHeight - margin - 9, { align: 'center' });

  doc.setFontSize(6);
  doc.setTextColor(...textDarkGray);
  doc.text(`Certificado gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' })}`, pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

  doc.setFontSize(5);
  doc.setTextColor(68, 68, 68);
  doc.text('© 2024 Dr. Sidney Regozoni. Todos os direitos reservados.', pageWidth / 2, pageHeight - margin, { align: 'center' });

  // Return as base64
  return doc.output('datauristring').split(',')[1];
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

    console.log(`Sending completion emails with PDF certificate to all signatories for contract: ${contractId}`);

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

    // Generate PDF certificate
    console.log("Generating PDF certificate...");
    const certificateBase64 = generateCertificatePdf(
      contract,
      signatories,
      signatures || [],
      auditLogs || []
    );
    console.log("PDF certificate generated successfully");

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

    // Send email to each signatory with PDF certificate attached
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
                            📎 O certificado PDF está anexado a este email
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
                            <strong style="color: #D4AF37;">⚖️ Validade Jurídica:</strong> Este contrato foi assinado eletronicamente em conformidade com a Lei nº 14.063/2020. A trilha de auditoria completa está disponível no certificado PDF anexo.
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
            filename: `certificado-${contract.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`,
            content: certificateBase64,
          }
        ],
      });
    });

    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Completion emails with PDF certificate sent: ${successCount} success, ${failedCount} failed`);

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
