import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Scale, Pen, Type, Check, Loader2, AlertCircle, FileText, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const signatureCanvasRef = useRef<SignatureCanvas>(null);
  const documentEndRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signatory, setSignatory] = useState<Signatory | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [signatureType, setSignatureType] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // New state for two-step flow
  const [step, setStep] = useState<Step>('reading');
  const [hasReadDocument, setHasReadDocument] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    if (token) {
      fetchSigningData();
    }
  }, [token]);

  // Load PDF when contract is available
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
        .createSignedUrl(contract.file_path, 3600); // 1 hour expiry
      
      if (data?.signedUrl) {
        setPdfUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Error loading PDF:', err);
    }
    setLoadingPdf(false);
  };

  const fetchSigningData = async () => {
    // Find signatory by access token
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

    // Fetch contract
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

    // Log view action (using edge function would be better for IP)
    await supabase.from('audit_logs').insert({
      contract_id: contractData.id,
      signatory_id: signatoryData.id,
      action: 'viewed',
      ip_address: 'N/A',
      user_agent: navigator.userAgent,
    });
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
    // Scroll to top when transitioning
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
      // Create signature field if doesn't exist (simplified - normally would be positioned by owner)
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

      // Save signature
      const { error: signatureError } = await supabase
        .from('signatures')
        .insert({
          signatory_id: signatory.id,
          field_id: field.id,
          signature_type: signatureType,
          signature_data: signatureData,
          ip_address: 'N/A',
          user_agent: navigator.userAgent,
        });

      if (signatureError) {
        toast.error('Erro ao salvar assinatura');
        setSubmitting(false);
        return;
      }

      // Update signatory as signed
      await supabase
        .from('contract_signatories')
        .update({ signed_at: new Date().toISOString() })
        .eq('id', signatory.id);

      // Log signing action
      await supabase.from('audit_logs').insert({
        contract_id: contract.id,
        signatory_id: signatory.id,
        action: 'signed',
        ip_address: 'N/A',
        user_agent: navigator.userAgent,
        metadata: { signature_type: signatureType },
      });

      // Check if all signatories have signed
      const { data: allSignatories } = await supabase
        .from('contract_signatories')
        .select('signed_at')
        .eq('contract_id', contract.id);

      const allSigned = allSignatories?.every(s => s.signed_at);
      const remainingCount = allSignatories?.filter(s => !s.signed_at).length || 0;

      // 1. Send signature confirmation to the signatory (with contract PDF attached if available)
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
            filePath: contract.file_path, // Pass file path for attachment
          },
        });
      } catch (emailErr) {
        console.error('Error sending signature confirmation:', emailErr);
      }

      // 2. Notify contract owner about the new signature
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

      if (allSigned) {
        await supabase
          .from('contracts')
          .update({ status: 'completed' })
          .eq('id', contract.id);

        await supabase.from('audit_logs').insert({
          contract_id: contract.id,
          action: 'completed',
          ip_address: 'N/A',
          user_agent: navigator.userAgent,
        });

        // 3. Send completion email to contract owner
        try {
          const { data: notifyData, error: notifyError } = await supabase.functions.invoke('send-owner-completion-email', {
            body: {
              contractId: contract.id,
              accessToken: token,
              origin: window.location.origin,
            },
          });

          if (notifyError || !notifyData?.success) {
            console.error('Owner completion email failed:', notifyError || notifyData?.error);
          }
        } catch (emailErr) {
          console.error('Error sending owner completion email:', emailErr);
        }

        // 4. Send completion emails to ALL signatories
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
        // Update to partially signed if not all signed
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full card-premium gold-border">
          <CardContent className="pt-6 text-center">
            {error.includes('sucesso') ? (
              <Check className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
            ) : (
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            )}
            <h2 className="text-xl font-semibold mb-2">
              {error.includes('sucesso') ? 'Concluído!' : 'Ops!'}
            </h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-primary/20 bg-card sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center gold-border">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold gold-text">Regozoni Docs</span>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            <span className={`px-3 py-1 rounded-full ${step === 'reading' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
              1. Leitura
            </span>
            <ChevronDown className="h-4 w-4 rotate-[-90deg] text-muted-foreground" />
            <span className={`px-3 py-1 rounded-full ${step === 'signing' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
              2. Assinatura
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        {/* Contract Info - Always visible */}
        <Card className="mb-6 card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {contract?.title}
            </CardTitle>
            {contract?.description && (
              <CardDescription>{contract.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 gold-border">
              <p className="text-sm text-muted-foreground mb-1">Assinando como:</p>
              <p className="font-medium">{signatory?.name}</p>
              <p className="text-sm text-muted-foreground">{signatory?.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Reading */}
        {step === 'reading' && (
          <div className="space-y-6">
            {/* PDF Viewer */}
            <Card className="card-premium gold-border overflow-hidden">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-lg">Documento para Revisão</CardTitle>
                <CardDescription>
                  Leia atentamente o documento abaixo antes de prosseguir para a assinatura
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingPdf ? (
                  <div className="flex items-center justify-center h-[600px] bg-muted/20">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Carregando documento...</p>
                    </div>
                  </div>
                ) : pdfUrl ? (
                  <div className="relative">
                    <iframe
                      src={`${pdfUrl}#view=FitH`}
                      className="w-full h-[600px] md:h-[700px] border-0"
                      title="Documento para assinatura"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px] bg-muted/20">
                    <div className="text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Documento não disponível para visualização</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Verifique o anexo do email ou entre em contato com o remetente
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Confirmation Section */}
            <Card className="card-premium gold-border" ref={documentEndRef}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg mb-6">
                  <Checkbox
                    id="read-confirmation"
                    checked={hasReadDocument}
                    onCheckedChange={(checked) => setHasReadDocument(checked === true)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="read-confirmation"
                    className="text-sm leading-relaxed cursor-pointer select-none"
                  >
                    <span className="font-medium">Li e compreendi os termos deste documento.</span>
                    <br />
                    <span className="text-muted-foreground">
                      Declaro que revisei todas as cláusulas e condições apresentadas e estou de acordo em prosseguir para a assinatura eletrônica.
                    </span>
                  </label>
                </div>

                <Button
                  className="w-full btn-gold"
                  size="lg"
                  onClick={handleProceedToSigning}
                  disabled={!hasReadDocument}
                >
                  <Pen className="h-4 w-4 mr-2" />
                  Prosseguir para Assinatura
                </Button>

                {!hasReadDocument && (
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Marque a confirmação acima para habilitar o botão
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Signing */}
        {step === 'signing' && (
          <Card className="card-premium gold-border">
            <CardHeader>
              <CardTitle>Sua Assinatura</CardTitle>
              <CardDescription>
                Escolha como deseja assinar o documento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as 'draw' | 'type')}>
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
                  <TabsTrigger value="draw" className="flex items-center gap-2">
                    <Pen className="h-4 w-4" />
                    Desenhar
                  </TabsTrigger>
                  <TabsTrigger value="type" className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Digitar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="draw">
                  <div className="border rounded-lg bg-white overflow-hidden">
                    <SignatureCanvas
                      ref={signatureCanvasRef}
                      canvasProps={{
                        className: 'w-full h-48 cursor-crosshair',
                        style: { width: '100%', height: '192px' }
                      }}
                      backgroundColor="white"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSignature}
                    className="mt-2"
                  >
                    Limpar
                  </Button>
                </TabsContent>

                <TabsContent value="type">
                  <div className="space-y-4">
                    <Input
                      placeholder="Digite seu nome completo"
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      className="text-xl"
                    />
                    {typedSignature && (
                      <div className="border rounded-lg p-6 bg-white text-center">
                        <p 
                          className="text-3xl text-gray-900"
                          style={{ fontFamily: "'Dancing Script', cursive" }}
                        >
                          {typedSignature}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6 pt-6 border-t border-primary/20">
                <p className="text-xs text-muted-foreground mb-4">
                  Ao clicar em "Assinar documento", você concorda que sua assinatura eletrônica 
                  será legalmente vinculante, com o mesmo valor de uma assinatura manuscrita.
                </p>
                
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    size="lg"
                    onClick={() => setStep('reading')}
                    className="flex-1"
                  >
                    Voltar ao Documento
                  </Button>
                  <Button 
                    className="flex-1 btn-gold" 
                    size="lg"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Assinar documento
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by <span className="gold-text font-medium">Regozoni Docs</span>
        </p>
      </main>
    </div>
  );
}
