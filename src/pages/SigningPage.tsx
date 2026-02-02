import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, Pen, Type, Check, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

interface Signatory {
  id: string;
  name: string;
  email: string;
  signed_at: string | null;
  contract_id: string;
}

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const signatureCanvasRef = useRef<SignatureCanvas>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signatory, setSignatory] = useState<Signatory | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [signatureType, setSignatureType] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchSigningData();
    }
  }, [token]);

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
      .select('id, title, description, status')
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
      <header className="border-b border-primary/20 bg-card">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center gold-border">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold gold-text">Regozoni Docs</span>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        {/* Contract Info */}
        <Card className="mb-6 card-premium">
          <CardHeader>
            <CardTitle>{contract?.title}</CardTitle>
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

        {/* Signature */}
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
              <Button 
                className="w-full btn-gold" 
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
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by <span className="gold-text font-medium">Regozoni Docs</span>
        </p>
      </main>
    </div>
  );
}
