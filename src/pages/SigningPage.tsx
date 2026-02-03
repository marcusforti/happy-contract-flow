import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Scale, Pen, Type, Check, Loader2, AlertCircle, FileText, ArrowRight, ArrowLeft, User, Mail, Download, FileType } from 'lucide-react';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to check if file is a PDF (can be rendered in iframe)
const isPdfFile = (filePath: string | null): boolean => {
  if (!filePath) return false;
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext === 'pdf';
};

const isWordFile = (filePath: string | null): boolean => {
  if (!filePath) return false;
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext === 'doc' || ext === 'docx';
};

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: string;
  owner_id: string;
  document_hash: string | null;
  file_path: string | null;
}

interface Signatory {
  id: string;
  name: string;
  email: string;
  signed_at: string | null;
  contract_id: string;
}

type Step = 'reading' | 'signing';

interface ClientInfo {
  ip_address: string;
  user_agent: string;
  accept_language: string;
  geolocation: {
    country: string | null;
    city: string | null;
    region: string | null;
  } | null;
  timestamp: string;
}

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const signatureCanvasRef = useRef<SignatureCanvas>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signatory, setSignatory] = useState<Signatory | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [signatureType, setSignatureType] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [step, setStep] = useState<Step>('reading');
  const [hasReadDocument, setHasReadDocument] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [termsAcceptedLogged, setTermsAcceptedLogged] = useState(false);

  useEffect(() => {
    if (token) {
      fetchClientInfo();
      fetchSigningData();
    }
  }, [token]);

  const fetchClientInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-client-info');
      if (!error && data) {
        setClientInfo(data);
        console.log('Client info captured:', data.ip_address);
      }
    } catch (err) {
      console.error('Error fetching client info:', err);
      // Fallback to N/A if the function fails
      setClientInfo({
        ip_address: 'N/A',
        user_agent: navigator.userAgent,
        accept_language: navigator.language,
        geolocation: null,
        timestamp: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    if (contract?.file_path) {
      loadPdfDocument();
    }
  }, [contract?.file_path]);

  const loadPdfDocument = async () => {
    if (!contract?.file_path) return;
    
    setLoadingPdf(true);
    try {
      const { data } = await supabase.storage
        .from('contracts')
        .createSignedUrl(contract.file_path, 3600);
      
      if (data?.signedUrl) {
        setPdfUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Error loading PDF:', err);
    }
    setLoadingPdf(false);
  };

  const fetchSigningData = async () => {
    const { data: signatoryData, error: signatoryError } = await supabase
      .from('contract_signatories')
      .select('*')
      .eq('access_token', token)
      .single();

    if (signatoryError || !signatoryData) {
      setError('Link de assinatura inválido ou expirado');
      setLoading(false);
      return;
    }

    if (signatoryData.signed_at) {
      setError('Este documento já foi assinado');
      setLoading(false);
      return;
    }

    setSignatory(signatoryData);

    const { data: contractData, error: contractError } = await supabase
      .from('contracts')
      .select('id, title, description, status, owner_id, document_hash, file_path')
      .eq('id', signatoryData.contract_id)
      .single();

    if (contractError || !contractData) {
      setError('Contrato não encontrado');
      setLoading(false);
      return;
    }

    if (contractData.status === 'expired') {
      setError('Este contrato expirou');
      setLoading(false);
      return;
    }

    if (contractData.status === 'draft') {
      setError('Este contrato ainda não foi enviado para assinatura');
      setLoading(false);
      return;
    }

    setContract(contractData);
    setLoading(false);
    
    // Log viewed event
    const ip = clientInfo?.ip_address || 'N/A';
    await supabase.from('audit_logs').insert({
      contract_id: contractData.id,
      signatory_id: signatoryData.id,
      action: 'viewed',
      ip_address: ip,
      user_agent: navigator.userAgent,
      metadata: clientInfo?.geolocation ? { geolocation: clientInfo.geolocation } : null,
    });
  };


  // Helper function to get current IP
  const getIpAddress = () => clientInfo?.ip_address || 'N/A';

  // Log terms acceptance when checkbox is clicked
  const handleTermsAcceptance = async (accepted: boolean) => {
    setHasReadDocument(accepted);
    
    if (accepted && !termsAcceptedLogged && signatory && contract) {
      setTermsAcceptedLogged(true);
      await supabase.from('audit_logs').insert({
        contract_id: contract.id,
        signatory_id: signatory.id,
        action: 'terms_accepted',
        ip_address: getIpAddress(),
        user_agent: navigator.userAgent,
        metadata: { 
          accepted_at: new Date().toISOString(),
          geolocation: clientInfo?.geolocation || null,
        },
      });
      console.log('Terms acceptance logged');
    }
  };

  const clearSignature = () => {
    if (signatureCanvasRef.current) {
      signatureCanvasRef.current.clear();
    }
  };

  const handleProceedToSigning = () => {
    if (!hasReadDocument) {
      toast.error('Por favor, confirme que leu o documento');
      return;
    }
    setStep('signing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!signatory || !contract) return;

    let signatureData = '';

    if (signatureType === 'draw') {
      if (!signatureCanvasRef.current || signatureCanvasRef.current.isEmpty()) {
        toast.error('Por favor, desenhe sua assinatura');
        return;
      }
      signatureData = signatureCanvasRef.current.toDataURL();
    } else {
      if (!typedSignature.trim()) {
        toast.error('Por favor, digite seu nome');
        return;
      }
      signatureData = typedSignature;
    }

    setSubmitting(true);

    try {
      const { data: field, error: fieldError } = await supabase
        .from('signature_fields')
        .insert({
          contract_id: contract.id,
          signatory_id: signatory.id,
          page_number: 1,
          x_position: 100,
          y_position: 700,
          width: 200,
          height: 50,
        })
        .select()
        .single();

      if (fieldError || !field) {
        toast.error('Erro ao criar campo de assinatura');
        setSubmitting(false);
        return;
      }

      const { error: signatureError } = await supabase
        .from('signatures')
        .insert({
          signatory_id: signatory.id,
          field_id: field.id,
          signature_type: signatureType,
          signature_data: signatureData,
          ip_address: getIpAddress(),
          user_agent: navigator.userAgent,
        });

      if (signatureError) {
        toast.error('Erro ao salvar assinatura');
        setSubmitting(false);
        return;
      }

      await supabase
        .from('contract_signatories')
        .update({ signed_at: new Date().toISOString() })
        .eq('id', signatory.id);

      await supabase.from('audit_logs').insert({
        contract_id: contract.id,
        signatory_id: signatory.id,
        action: 'signed',
        ip_address: getIpAddress(),
        user_agent: navigator.userAgent,
        metadata: { 
          signature_type: signatureType,
          geolocation: clientInfo?.geolocation || null,
        },
      });

      const { data: allSignatories } = await supabase
        .from('contract_signatories')
        .select('signed_at')
        .eq('contract_id', contract.id);

      const allSigned = allSignatories?.every(s => s.signed_at);
      const remainingCount = allSignatories?.filter(s => !s.signed_at).length || 0;

      try {
        const signedAtFormatted = new Date().toLocaleString('pt-BR', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        });
        
        await supabase.functions.invoke('send-signature-confirmation', {
          body: {
            signatoryEmail: signatory.email,
            signatoryName: signatory.name,
            contractTitle: contract.title,
            signedAt: signedAtFormatted,
            remainingSignatories: remainingCount,
            isLastSignature: allSigned,
            filePath: contract.file_path,
          },
        });
      } catch (emailErr) {
        console.error('Error sending signature confirmation:', emailErr);
      }

      try {
        await supabase.functions.invoke('notify-owner-signature', {
          body: {
            contractId: contract.id,
            accessToken: token,
            origin: window.location.origin,
          },
        });
      } catch (emailErr) {
        console.error('Error notifying owner:', emailErr);
      }

      // Use database function to update status (bypasses RLS for signatories)
      const { data: isCompleted } = await supabase.rpc('complete_contract_if_all_signed', {
        p_contract_id: contract.id
      });

      if (isCompleted) {
        await supabase.from('audit_logs').insert({
          contract_id: contract.id,
          action: 'completed',
          ip_address: getIpAddress(),
          user_agent: navigator.userAgent,
          metadata: { geolocation: clientInfo?.geolocation || null },
        });

        try {
          await supabase.functions.invoke('send-owner-completion-email', {
            body: {
              contractId: contract.id,
              accessToken: token,
              origin: window.location.origin,
            },
          });
        } catch (emailErr) {
          console.error('Error sending owner completion email:', emailErr);
        }

        try {
          await supabase.functions.invoke('send-all-completion-emails', {
            body: {
              contractId: contract.id,
              accessToken: token,
              origin: window.location.origin,
            },
          });
        } catch (emailErr) {
          console.error('Error sending all completion emails:', emailErr);
        }
      } else {
        await supabase
          .from('contracts')
          .update({ status: 'partially_signed' })
          .eq('id', contract.id);
      }

      toast.success('Assinatura realizada com sucesso!');
      setSignatory({ ...signatory, signed_at: new Date().toISOString() });
      setError('Documento assinado com sucesso! Você pode fechar esta página.');
    } catch (err) {
      toast.error('Erro inesperado ao assinar');
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 gold-border">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Carregando documento...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    const isSuccess = error.includes('sucesso');
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="card-premium gold-border overflow-hidden">
            <div className={`h-2 ${isSuccess ? 'bg-emerald-500' : 'bg-destructive'}`} />
            <CardContent className="pt-8 pb-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                {isSuccess ? (
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-emerald-500" />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                )}
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">
                {isSuccess ? 'Concluído!' : 'Ops!'}
              </h2>
              <p className="text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-primary/20 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center gold-border">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-bold gold-text">Regozoni Docs</span>
              </div>
            </div>
            
            {/* Step Progress - 2 steps */}
            <div className="flex items-center gap-1 sm:gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                step === 'reading' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-primary/20 text-primary'
              }`}>
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">Leitura</span>
                <span className="text-sm font-medium sm:hidden">1</span>
              </div>
              <div className="w-4 sm:w-6 h-0.5 bg-primary/30" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                step === 'signing' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Pen className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">Assinatura</span>
                <span className="text-sm font-medium sm:hidden">2</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-6 md:py-8">
        <AnimatePresence mode="wait">
          {step === 'reading' && (
            <motion.div
              key="reading"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Contract Header Card */}
              <Card className="card-premium overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
                        <FileText className="h-4 w-4" />
                        Documento para Assinatura
                      </div>
                      <h1 className="text-xl md:text-2xl font-bold mb-2">{contract?.title}</h1>
                      {contract?.description && (
                        <p className="text-muted-foreground text-sm">{contract.description}</p>
                      )}
                    </div>
                    
                    {/* Signatory Info */}
                    <div className="bg-muted/50 rounded-xl p-4 gold-border min-w-[200px]">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-sm">{signatory?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground truncate">{signatory?.email}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Document Viewer */}
              <Card className="card-premium gold-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Documento</CardTitle>
                      <CardDescription className="text-xs">
                        Leia atentamente antes de assinar
                      </CardDescription>
                    </div>
                    {pdfUrl && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(pdfUrl, '_blank')}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Baixar</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingPdf ? (
                    <div className="flex items-center justify-center h-[500px] md:h-[600px] bg-muted/10">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Carregando documento...</p>
                      </div>
                    </div>
                  ) : pdfUrl && isPdfFile(contract?.file_path) ? (
                    <iframe
                      src={`${pdfUrl}#view=FitH&toolbar=0&navpanes=0`}
                      className="w-full h-[500px] md:h-[650px] border-0"
                      title="Documento para assinatura"
                    />
                  ) : pdfUrl && isWordFile(contract?.file_path) ? (
                    <div className="flex items-center justify-center h-[400px] bg-muted/10">
                      <div className="text-center px-6 max-w-md">
                        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                          <FileType className="h-10 w-10 text-primary" />
                        </div>
                        <p className="text-foreground font-semibold text-lg mb-2">Documento Word</p>
                        <p className="text-sm text-muted-foreground mb-6">
                          Este documento está no formato Word (.docx). Clique no botão abaixo para baixar e visualizar o conteúdo completo.
                        </p>
                        <Button 
                          onClick={() => window.open(pdfUrl, '_blank')}
                          className="btn-gold gap-2"
                          size="lg"
                        >
                          <Download className="h-5 w-5" />
                          Baixar Documento Word
                        </Button>
                        <p className="text-xs text-muted-foreground mt-4">
                          Após ler o documento, volte aqui para confirmar e assinar.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] bg-muted/10">
                      <div className="text-center px-4">
                        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground font-medium mb-1">Documento não disponível</p>
                        <p className="text-xs text-muted-foreground">
                          Verifique o anexo do email ou entre em contato com o remetente
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Confirmation Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="card-premium gold-border">
                  <CardContent className="pt-6">
                    {/* Terms Checkbox */}
                    <div 
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        hasReadDocument 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border bg-muted/30 hover:border-primary/50'
                      }`}
                      onClick={() => handleTermsAcceptance(!hasReadDocument)}
                    >
                      <Checkbox
                        id="read-confirmation"
                        checked={hasReadDocument}
                        onCheckedChange={(checked) => handleTermsAcceptance(checked === true)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor="read-confirmation"
                          className="font-medium cursor-pointer block mb-1"
                        >
                          Li e compreendi os termos deste documento
                        </label>
                        <p className="text-sm text-muted-foreground">
                          Declaro que revisei todas as cláusulas e condições apresentadas e estou de acordo em prosseguir para a assinatura eletrônica.
                        </p>
                      </div>
                      {hasReadDocument && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                        >
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </motion.div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-6">
                      <Button
                        className="w-full btn-gold h-12 text-base"
                        onClick={handleProceedToSigning}
                        disabled={!hasReadDocument}
                      >
                        Prosseguir para Assinatura
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>
                      
                      {!hasReadDocument && (
                        <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
                          <Check className="h-3 w-3" />
                          Marque a confirmação acima para continuar
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}

          {step === 'signing' && (
            <motion.div
              key="signing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Signing Header */}
              <Card className="card-premium overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center gold-border">
                      <Pen className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Assine o Documento</h2>
                      <p className="text-sm text-muted-foreground">{contract?.title}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Signature Card */}
              <Card className="card-premium gold-border">
                <CardHeader>
                  <CardTitle className="text-lg">Sua Assinatura</CardTitle>
                  <CardDescription>
                    Escolha como deseja assinar o documento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as 'draw' | 'type')}>
                    <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-muted p-1">
                      <TabsTrigger value="draw" className="flex items-center gap-2 h-10 data-[state=active]:bg-background">
                        <Pen className="h-4 w-4" />
                        Desenhar
                      </TabsTrigger>
                      <TabsTrigger value="type" className="flex items-center gap-2 h-10 data-[state=active]:bg-background">
                        <Type className="h-4 w-4" />
                        Digitar
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="draw" className="mt-0">
                      <div className="space-y-3">
                      <div className="border-2 border-dashed border-border rounded-xl overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
                          <SignatureCanvas
                            ref={signatureCanvasRef}
                            canvasProps={{
                              className: 'w-full h-48 cursor-crosshair',
                              style: { width: '100%', height: '192px' }
                            }}
                            backgroundColor="white"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            Desenhe sua assinatura no campo acima
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearSignature}
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="type" className="mt-0">
                      <div className="space-y-4">
                        <Input
                          placeholder="Digite seu nome completo"
                          value={typedSignature}
                          onChange={(e) => setTypedSignature(e.target.value)}
                          className="text-lg h-12"
                        />
                        <AnimatePresence>
                          {typedSignature && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="border-2 border-dashed border-border rounded-xl p-8 text-center" style={{ backgroundColor: '#ffffff' }}
                            >
                              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                                Prévia da assinatura
                              </p>
                              <p 
                                className="text-3xl md:text-4xl"
                                style={{ fontFamily: "'Dancing Script', cursive", color: '#1a1a1a' }}
                              >
                                {typedSignature}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Legal Notice & Actions */}
                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="flex items-start gap-3 bg-muted/30 rounded-lg p-3 mb-6">
                      <Scale className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Ao clicar em "Assinar documento", você concorda que sua assinatura eletrônica 
                        será legalmente vinculante, com o mesmo valor de uma assinatura manuscrita.
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={() => setStep('reading')}
                        className="flex-1 h-12"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar ao Documento
                      </Button>
                      <Button 
                        className="flex-1 btn-gold h-12" 
                        size="lg"
                        onClick={handleSubmit}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                          <Check className="h-5 w-5 mr-2" />
                        )}
                        Assinar documento
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground mt-8 pb-4"
        >
          Powered by <span className="gold-text font-medium">Regozoni Docs</span>
        </motion.p>
      </main>
    </div>
  );
}
