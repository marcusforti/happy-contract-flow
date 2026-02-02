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
  FileSignature, 
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
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  pending: { label: 'Aguardando assinaturas', icon: Clock, variant: 'outline' as const, color: 'text-amber-600' },
  partially_signed: { label: 'Parcialmente assinado', icon: AlertCircle, variant: 'default' as const, color: 'text-blue-600' },
  completed: { label: 'Concluído', icon: CheckCircle2, variant: 'default' as const, color: 'text-green-600' },
  expired: { label: 'Expirado', icon: AlertCircle, variant: 'destructive' as const, color: 'text-destructive' },
};

const actionLabels: Record<string, string> = {
  created: 'Contrato criado',
  viewed: 'Documento visualizado',
  signed: 'Assinatura realizada',
  completed: 'Contrato concluído',
  downloaded: 'Documento baixado',
  sent: 'Enviado para assinatura',
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
    if (!contract || !user) return;

    const { error } = await supabase
      .from('contracts')
      .update({ status: 'pending' })
      .eq('id', contract.id);

    if (error) {
      toast.error('Erro ao enviar contrato');
      return;
    }

    await supabase.from('audit_logs').insert({
      contract_id: contract.id,
      user_id: user.id,
      action: 'sent',
      ip_address: 'N/A',
      user_agent: navigator.userAgent,
    });

    toast.success('Contrato enviado para assinatura! Os signatários podem usar seus links para assinar.');
    fetchContractData();
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
      <header className="border-b bg-card">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Signatários ({signedCount}/{signatories.length})
                </CardTitle>
                <CardDescription>
                  Pessoas que devem assinar este contrato
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {signatories.map((signatory, index) => (
                    <div key={signatory.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{signatory.name}</p>
                          <p className="text-sm text-muted-foreground">{signatory.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {signatory.signed_at ? (
                          <Badge variant="default" className="bg-green-600">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
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
                      <div key={log.id} className="flex gap-4 pb-4 border-b last:border-0 last:pb-0">
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
            <Card>
              <CardHeader>
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contract.status === 'draft' && (
                  <Button className="w-full" onClick={sendForSigning}>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar para assinatura
                  </Button>
                )}
                {contract.file_path && (
                  <Button 
                    variant="outline" 
                    className="w-full" 
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
                  <Button variant="outline" className="w-full">
                    <FileSignature className="h-4 w-4 mr-2" />
                    Baixar certificado
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={config.color}>{config.label}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signatários</span>
                  <span>{signatories.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assinados</span>
                  <span className="text-green-600">{signedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pendentes</span>
                  <span className="text-amber-600">{signatories.length - signedCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
