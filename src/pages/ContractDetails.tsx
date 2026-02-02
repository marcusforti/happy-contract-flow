import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Scale, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  ExternalLink,
  Send,
  Download,
  Loader2,
  User,
  History,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { extractTextFromPDF } from '@/lib/pdf-utils';

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'pending' | 'partially_signed' | 'completed' | 'expired';
  signing_order: string;
  file_path: string | null;
  document_hash: string | null;
  created_at: string;
  expires_at: string | null;
}

interface Signatory {
  id: string;
  name: string;
  email: string;
  signing_order: number;
  access_token: string;
  signed_at: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  metadata: unknown;
}

const statusConfig = {
  draft: { label: 'Rascunho', icon: FileText, variant: 'secondary' as const, color: 'text-muted-foreground' },
  pending: { label: 'Aguardando assinaturas', icon: Clock, variant: 'outline' as const, color: 'text-amber-500' },
  partially_signed: { label: 'Parcialmente assinado', icon: AlertCircle, variant: 'default' as const, color: 'text-blue-500' },
  completed: { label: 'Concluído', icon: CheckCircle2, variant: 'default' as const, color: 'text-emerald-500' },
  expired: { label: 'Expirado', icon: AlertCircle, variant: 'destructive' as const, color: 'text-destructive' },
};

const actionLabels: Record<string, string> = {
  created: 'Contrato criado',
  viewed: 'Documento visualizado',
  signed: 'Assinatura realizada',
  completed: 'Contrato concluído',
  downloaded: 'Documento baixado',
  sent: 'Enviado para assinatura',
  certificate_downloaded: 'Certificado baixado',
  email_resent: 'Email reenviado',
};

export default function ContractDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (id) {
      fetchContractData();
    }
  }, [id]);

  const fetchContractData = async () => {
    // Fetch contract
    const { data: contractData, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single();

    if (contractError || !contractData) {
      toast.error('Contrato não encontrado');
      navigate('/dashboard');
      return;
    }

    setContract(contractData);

    // Fetch signatories
    const { data: signatoriesData } = await supabase
      .from('contract_signatories')
      .select('*')
      .eq('contract_id', id)
      .order('signing_order');

    if (signatoriesData) {
      setSignatories(signatoriesData);
    }

    // Fetch audit logs
    const { data: logsData } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('contract_id', id)
      .order('created_at', { ascending: false });

    if (logsData) {
      setAuditLogs(logsData);
    }

    setLoading(false);
  };

  const copySigningLink = (accessToken: string) => {
    const link = `${window.location.origin}/sign/${accessToken}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado para a área de transferência!');
  };

  const sendForSigning = async () => {
    if (!contract || !user || signatories.length === 0) return;

    setSending(true);

    try {
      // Update contract status
      const { error } = await supabase
        .from('contracts')
        .update({ status: 'pending' })
        .eq('id', contract.id);

      if (error) {
        toast.error('Erro ao enviar contrato');
        setSending(false);
        return;
      }

      // Get sender name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      const senderName = profile?.full_name || user.email || 'Regozoni Docs';

      // Fetch PDF once and extract text for IA email generation
      let pdfText: string | null = null;
      if (contract.file_path) {
        try {
          toast.info('Analisando contrato com IA...');
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('contracts')
            .createSignedUrl(contract.file_path, 60);

          if (!signedUrlError && signedUrlData?.signedUrl) {
            const response = await fetch(signedUrlData.signedUrl);
            if (response.ok) {
              const pdfBlob = await response.blob();
              const pdfFile = new File([pdfBlob], 'contract.pdf', { type: 'application/pdf' });
              const extracted = await extractTextFromPDF(pdfFile);
              if (extracted && extracted.length >= 50) {
                pdfText = extracted;
              }
            }
          }
        } catch (err) {
          console.warn('Could not extract PDF text for IA email generation:', err);
          // Fallback to default email body if IA fails
        }
      }

      // Send emails to all pending signatories
      const pendingSignatories = signatories.filter(s => !s.signed_at);
      let emailsSent = 0;
      let emailsFailed = 0;

      for (const signatory of pendingSignatories) {
        const signingLink = `${window.location.origin}/sign/${signatory.access_token}`;

        // Try to generate an AI body (optional)
        let customBody: string | undefined;
        if (pdfText) {
          try {
            const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-email-body', {
              body: {
                pdfText,
                contractTitle: contract.title,
                senderName,
                signatoryName: signatory.name,
                expiresAt: contract.expires_at
                  ? format(new Date(contract.expires_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : undefined,
              },
            });

            if (!aiError && aiData?.success && aiData?.body) {
              customBody = aiData.body;
            }
          } catch (err) {
            console.warn('AI email generation failed, falling back to default:', err);
          }
        }
        
        const { data, error: emailError } = await supabase.functions.invoke('send-signing-email', {
          body: {
            to: signatory.email,
            signatoryName: signatory.name,
            contractTitle: contract.title,
            signingLink,
            senderName,
            customBody,
          },
        });

        if (emailError || !data?.success) {
          console.error(`Failed to send email to ${signatory.email}:`, emailError || data?.error);
          emailsFailed++;
        } else {
          emailsSent++;
        }
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        contract_id: contract.id,
        user_id: user.id,
        action: 'sent',
        ip_address: 'N/A',
        user_agent: navigator.userAgent,
        metadata: { emails_sent: emailsSent, emails_failed: emailsFailed },
      });

      if (emailsFailed > 0 && emailsSent > 0) {
        toast.warning(`Contrato enviado! ${emailsSent} email(s) enviado(s), ${emailsFailed} falhou(aram).`);
      } else if (emailsFailed > 0) {
        toast.error('Contrato enviado, mas falha ao enviar emails. Os signatários podem usar os links copiados manualmente.');
      } else {
        toast.success(`Contrato enviado! ${emailsSent} email(s) enviado(s) para os signatários.`);
      }

      fetchContractData();
    } catch (err) {
      console.error('Error sending for signing:', err);
      toast.error('Erro inesperado ao enviar contrato');
    }

    setSending(false);
  };

  const downloadDocument = async () => {
    if (!contract?.file_path || !user) return;

    setDownloading(true);
    try {
      // Generate signed URL (valid for 60 seconds)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('contracts')
        .createSignedUrl(contract.file_path, 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Não foi possível gerar URL para download');
      }

      // Fetch the file
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) throw new Error('Erro ao baixar arquivo');

      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = contract.file_path.split('/').pop() || `${contract.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Register audit log
      await supabase.from('audit_logs').insert({
        contract_id: contract.id,
        user_id: user.id,
        action: 'downloaded',
        ip_address: 'N/A',
        user_agent: navigator.userAgent,
      });

      toast.success('Download iniciado!');
      fetchContractData();
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao baixar documento');
    } finally {
      setDownloading(false);
    }
  };

  const downloadCertificate = async () => {
    if (!contract || contract.status !== 'completed' || !user) return;

    setDownloadingCertificate(true);
    try {
      // Fetch detailed signatures with IP and user_agent
      const { data: signaturesData, error: signaturesError } = await supabase
        .from('signatures')
        .select(`
          id,
          ip_address,
          user_agent,
          created_at,
          signature_type,
          signatory_id,
          contract_signatories!inner (
            id,
            name,
            email,
            signed_at,
            contract_id
          )
        `)
        .eq('contract_signatories.contract_id', contract.id);

      if (signaturesError) {
        console.error('Error fetching signatures:', signaturesError);
      }

      // Map signatures to signatories
      const signatoryDetails = signatories.map(signatory => {
        const signature = signaturesData?.find(s => s.signatory_id === signatory.id);
        return {
          name: signatory.name,
          email: signatory.email,
          signed_at: signatory.signed_at,
          ip_address: signature?.ip_address || 'N/A',
          user_agent: signature?.user_agent || 'N/A',
          signature_type: signature?.signature_type || 'N/A',
        };
      });

      // Format dates helper
      const formatDateTime = (dateStr: string) => {
        return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
      };

      const formatDate = (dateStr: string) => {
        return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
      };

      // Parse user agent to get browser info
      const parseUserAgent = (ua: string): string => {
        if (!ua || ua === 'N/A') return 'N/A';
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return ua.substring(0, 50) + '...';
      };

      // Find completion date (last signature or completed audit log)
      const completedLog = auditLogs.find(log => log.action === 'completed');
      const lastSignature = signatoryDetails
        .filter(s => s.signed_at)
        .sort((a, b) => new Date(b.signed_at!).getTime() - new Date(a.signed_at!).getTime())[0];
      const completionDate = completedLog?.created_at || lastSignature?.signed_at || contract.created_at;

      // Generate HTML certificate
      const certificateHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificado de Conclusão - ${contract.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0a0a0a;
      color: #f2f2f2;
      padding: 40px;
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: linear-gradient(180deg, #141414 0%, #0f0f0f 100%);
      border: 1px solid rgba(202, 138, 4, 0.3);
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #ca8a04 0%, #a16207 100%);
      color: #0a0a0a;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.8;
    }
    .section {
      padding: 25px 30px;
      border-bottom: 1px solid rgba(202, 138, 4, 0.15);
    }
    .section:last-child { border-bottom: none; }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #ca8a04;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-item label {
      font-size: 12px;
      color: #999;
      display: block;
      margin-bottom: 4px;
    }
    .info-item span {
      font-size: 14px;
      color: #f2f2f2;
    }
    .hash-box {
      background: #1a1a1a;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      word-break: break-all;
      color: #ca8a04;
    }
    .signatory-card {
      background: #1a1a1a;
      border: 1px solid rgba(202, 138, 4, 0.2);
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 12px;
    }
    .signatory-card:last-child { margin-bottom: 0; }
    .signatory-name {
      font-weight: 600;
      color: #f2f2f2;
      margin-bottom: 8px;
    }
    .signatory-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 12px;
    }
    .signatory-details span {
      color: #999;
    }
    .signatory-details strong {
      color: #f2f2f2;
    }
    .audit-item {
      display: flex;
      gap: 15px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .audit-item:last-child { border-bottom: none; }
    .audit-date {
      font-size: 12px;
      color: #999;
      min-width: 140px;
    }
    .audit-action {
      font-size: 13px;
      color: #f2f2f2;
    }
    .legal-notice {
      background: rgba(202, 138, 4, 0.1);
      border-left: 3px solid #ca8a04;
      padding: 15px;
      font-size: 12px;
      color: #ccc;
    }
    .legal-notice strong {
      color: #ca8a04;
      display: block;
      margin-bottom: 5px;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 11px;
      color: #666;
      border-top: 1px solid rgba(202, 138, 4, 0.15);
    }
    .badge {
      display: inline-block;
      background: #166534;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-left: 8px;
    }
    @media print {
      body { background: #fff; color: #000; padding: 20px; }
      .container { border: 1px solid #ccc; }
      .header { background: #ca8a04; }
      .section { border-color: #eee; }
      .signatory-card { background: #f9f9f9; border-color: #ddd; }
      .hash-box { background: #f5f5f5; }
      .legal-notice { background: #fffbeb; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CERTIFICADO DE CONCLUSÃO</h1>
      <p>Regozoni Docs - Plataforma de Assinatura Eletrônica</p>
    </div>

    <div class="section">
      <div class="section-title">📄 Identificação do Documento</div>
      <div class="info-grid">
        <div class="info-item">
          <label>Título do Contrato</label>
          <span>${contract.title}</span>
        </div>
        <div class="info-item">
          <label>Status</label>
          <span>Concluído <span class="badge">✓ Assinado</span></span>
        </div>
        <div class="info-item">
          <label>Data de Criação</label>
          <span>${formatDate(contract.created_at)}</span>
        </div>
        <div class="info-item">
          <label>Data de Conclusão</label>
          <span>${formatDate(completionDate)}</span>
        </div>
      </div>
      ${contract.description ? `
      <div class="info-item" style="margin-top: 15px;">
        <label>Descrição</label>
        <span>${contract.description}</span>
      </div>
      ` : ''}
      ${contract.document_hash ? `
      <div style="margin-top: 15px;">
        <label style="font-size: 12px; color: #999; display: block; margin-bottom: 8px;">Hash SHA-256 do Documento</label>
        <div class="hash-box">${contract.document_hash}</div>
      </div>
      ` : ''}
    </div>

    <div class="section">
      <div class="section-title">✍️ Signatários (${signatoryDetails.length})</div>
      ${signatoryDetails.map((sig, idx) => `
      <div class="signatory-card">
        <div class="signatory-name">${idx + 1}. ${sig.name}</div>
        <div class="signatory-details">
          <div><span>E-mail:</span> <strong>${sig.email}</strong></div>
          <div><span>Assinado em:</span> <strong>${sig.signed_at ? formatDateTime(sig.signed_at) : 'Pendente'}</strong></div>
          <div><span>Endereço IP:</span> <strong>${sig.ip_address}</strong></div>
          <div><span>Navegador:</span> <strong>${parseUserAgent(sig.user_agent)}</strong></div>
          <div><span>Tipo de Assinatura:</span> <strong>${sig.signature_type === 'draw' ? 'Desenhada' : sig.signature_type === 'type' ? 'Digitada' : sig.signature_type}</strong></div>
        </div>
      </div>
      `).join('')}
    </div>

    <div class="section">
      <div class="section-title">📋 Trilha de Auditoria</div>
      ${auditLogs.slice(0, 20).map(log => `
      <div class="audit-item">
        <div class="audit-date">${formatDateTime(log.created_at)}</div>
        <div class="audit-action">${actionLabels[log.action] || log.action}${log.ip_address && log.ip_address !== 'N/A' ? ` (IP: ${log.ip_address})` : ''}</div>
      </div>
      `).join('')}
    </div>

    <div class="section">
      <div class="legal-notice">
        <strong>⚖️ Validade Jurídica</strong>
        Este documento foi assinado eletronicamente através da plataforma Regozoni Docs, em conformidade com a 
        <strong style="display: inline;">Lei nº 14.063/2020</strong> que dispõe sobre o uso de assinaturas eletrônicas 
        em interações com entes públicos, em atos de pessoas jurídicas e em questões de saúde. A assinatura eletrônica 
        simples utilizada neste documento possui validade jurídica quando associada à trilha de auditoria completa, 
        identificação dos signatários e hash do documento para verificação de integridade.
      </div>
    </div>

    <div class="footer">
      Certificado gerado em ${formatDateTime(new Date().toISOString())} | Regozoni Docs | ID do Contrato: ${contract.id}
    </div>
  </div>
</body>
</html>
`;

      // Create blob and download
      const blob = new Blob([certificateHtml], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${contract.title.toLowerCase().replace(/\s+/g, '-')}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Register audit log
      await supabase.from('audit_logs').insert({
        contract_id: contract.id,
        user_id: user.id,
        action: 'certificate_downloaded',
        ip_address: 'N/A',
        user_agent: navigator.userAgent,
      });

      toast.success('Certificado baixado com sucesso!');
      fetchContractData();
    } catch (error) {
      console.error('Certificate download error:', error);
      toast.error('Erro ao gerar certificado');
    } finally {
      setDownloadingCertificate(false);
    }
  };

  const resendEmails = async () => {
    if (!contract || !user || !contract.file_path) return;

    const pendingSignatories = signatories.filter(s => !s.signed_at);
    if (pendingSignatories.length === 0) {
      toast.info('Todos os signatários já assinaram o contrato.');
      return;
    }

    setResending(true);

    try {
      // Get sender name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      const senderName = profile?.full_name || user.email || 'Regozoni Docs';

      // Fetch PDF from storage to extract text
      toast.info('Analisando contrato com IA...');
      
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('contracts')
        .createSignedUrl(contract.file_path, 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Não foi possível acessar o documento');
      }

      // Fetch and extract PDF text
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) throw new Error('Erro ao baixar documento');
      
      const pdfBlob = await response.blob();
      const pdfFile = new File([pdfBlob], 'contract.pdf', { type: 'application/pdf' });
      const pdfText = await extractTextFromPDF(pdfFile);

      if (!pdfText || pdfText.length < 50) {
        throw new Error('Não foi possível extrair texto do PDF');
      }

      // Send emails to all pending signatories with AI-generated body
      let emailsSent = 0;
      let emailsFailed = 0;

      for (const signatory of pendingSignatories) {
        try {
          // Generate AI email body for each signatory
          const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-email-body', {
            body: {
              pdfText,
              contractTitle: contract.title,
              senderName,
              signatoryName: signatory.name,
              expiresAt: contract.expires_at 
                ? format(new Date(contract.expires_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                : undefined,
            },
          });

          if (aiError) {
            console.error(`AI error for ${signatory.email}:`, aiError);
            throw new Error('Erro ao gerar corpo do email');
          }

          const customBody = aiData?.body;
          const signingLink = `${window.location.origin}/sign/${signatory.access_token}`;

          // Send email with custom AI-generated body
          const { data: emailData, error: emailError } = await supabase.functions.invoke('send-signing-email', {
            body: {
              to: signatory.email,
              signatoryName: signatory.name,
              contractTitle: contract.title,
              signingLink,
              senderName,
              customBody,
            },
          });

          if (emailError || !emailData?.success) {
            console.error(`Failed to send email to ${signatory.email}:`, emailError || emailData?.error);
            emailsFailed++;
          } else {
            emailsSent++;
          }
        } catch (err) {
          console.error(`Error processing signatory ${signatory.email}:`, err);
          emailsFailed++;
        }
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        contract_id: contract.id,
        user_id: user.id,
        action: 'email_resent',
        ip_address: 'N/A',
        user_agent: navigator.userAgent,
        metadata: { 
          signatories_notified: emailsSent, 
          signatories_failed: emailsFailed,
          ai_generated: true 
        },
      });

      if (emailsFailed > 0 && emailsSent > 0) {
        toast.warning(`${emailsSent} email(s) reenviado(s) com IA, ${emailsFailed} falhou(aram).`);
      } else if (emailsFailed > 0 && emailsSent === 0) {
        toast.error('Falha ao reenviar emails. Tente novamente.');
      } else {
        toast.success(`${emailsSent} email(s) reenviado(s) com corpo personalizado por IA!`);
      }

      fetchContractData();
    } catch (err) {
      console.error('Error resending emails:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao reenviar emails');
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contract) return null;

  const config = statusConfig[contract.status];
  const StatusIcon = config.icon;
  const signedCount = signatories.filter(s => s.signed_at).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-primary/20 bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{contract.title}</h1>
            <p className="text-sm text-muted-foreground">
              Criado em {format(new Date(contract.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <Badge variant={config.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contract Info */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Detalhes do Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contract.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                    <p>{contract.description}</p>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ordem de assinatura</p>
                    <p>{contract.signing_order === 'sequential' ? 'Sequencial' : 'Paralela'}</p>
                  </div>
                  {contract.expires_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Expira em</p>
                      <p>{format(new Date(contract.expires_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                    </div>
                  )}
                </div>
                {contract.document_hash && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hash do documento (SHA-256)</p>
                    <p className="text-xs font-mono break-all bg-muted p-2 rounded">{contract.document_hash}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signatories */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Signatários ({signedCount}/{signatories.length})
                </CardTitle>
                <CardDescription>
                  Pessoas que devem assinar este contrato
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {signatories.map((signatory, index) => (
                    <div key={signatory.id} className="flex items-center justify-between p-4 border border-primary/20 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium gold-border">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{signatory.name}</p>
                          <p className="text-sm text-muted-foreground">{signatory.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {signatory.signed_at ? (
                          <Badge variant="default" className="bg-emerald-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Assinado
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="outline">Pendente</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copySigningLink(signatory.access_token)}
                              title="Copiar link de assinatura"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Abrir página de assinatura"
                            >
                              <Link to={`/sign/${signatory.access_token}`} target="_blank">
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Audit Trail */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Trilha de Auditoria
                </CardTitle>
                <CardDescription>
                  Registro de todas as ações realizadas neste contrato
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhum registro ainda</p>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex gap-4 pb-4 border-b border-primary/10 last:border-0 last:pb-0">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <p className="font-medium">{actionLabels[log.action] || log.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(log.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          {log.ip_address && log.ip_address !== 'N/A' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              IP: {log.ip_address}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card className="card-premium gold-border">
              <CardHeader>
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contract.status === 'draft' && (
                  <Button 
                    className="w-full btn-gold" 
                    onClick={sendForSigning}
                    disabled={sending}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {sending ? 'Enviando...' : 'Enviar para assinatura'}
                  </Button>
                )}
                {(contract.status === 'pending' || contract.status === 'partially_signed') && (
                  <Button 
                    className="w-full btn-gold" 
                    onClick={resendEmails}
                    disabled={resending}
                  >
                    {resending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {resending ? 'Gerando email com IA...' : 'Reenviar emails'}
                  </Button>
                )}
                {contract.file_path && (
                  <Button 
                    variant="outline" 
                    className="w-full gold-border" 
                    onClick={downloadDocument}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {downloading ? 'Baixando...' : 'Baixar documento'}
                  </Button>
                )}
                {contract.status === 'completed' && (
                  <Button 
                    variant="outline" 
                    className="w-full gold-border"
                    onClick={downloadCertificate}
                    disabled={downloadingCertificate}
                  >
                    {downloadingCertificate ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Scale className="h-4 w-4 mr-2" />
                    )}
                    {downloadingCertificate ? 'Gerando...' : 'Baixar certificado'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Status Summary */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={config.color}>{config.label}</span>
                </div>
                <Separator className="bg-primary/20" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signatários</span>
                  <span>{signatories.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assinados</span>
                  <span className="text-emerald-500">{signedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pendentes</span>
                  <span className="text-amber-500">{signatories.length - signedCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
