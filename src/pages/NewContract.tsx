import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Plus, Trash2, Upload, Scale, CalendarIcon, Loader2, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { extractTextFromPDF } from '@/lib/pdf-utils';

const signatorySchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
});

const contractSchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  description: z.string().optional(),
  signingOrder: z.enum(['sequential', 'parallel']),
  expiresAt: z.date().optional(),
  signatories: z.array(signatorySchema).min(1, 'Adicione pelo menos um signatário'),
});

type ContractForm = z.infer<typeof contractSchema>;

type Step = 'upload' | 'form';

export default function NewContract() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('upload');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const form = useForm<ContractForm>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      title: '',
      description: '',
      signingOrder: 'parallel',
      signatories: [{ name: '', email: '' }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'signatories',
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Arquivo deve ter no máximo 10MB');
      return;
    }

    setFile(selectedFile);
  };

  const analyzeContract = async () => {
    if (!file) {
      toast.error('Selecione um arquivo PDF primeiro');
      return;
    }

    setIsAnalyzing(true);

    try {
      // Extract text from PDF
      toast.info('Extraindo texto do PDF...');
      const pdfText = await extractTextFromPDF(file);

      if (!pdfText || pdfText.length < 50) {
        toast.error('Não foi possível extrair texto suficiente do PDF. O documento pode ser uma imagem.');
        setIsAnalyzing(false);
        return;
      }

      // Send to AI for analysis
      toast.info('Analisando contrato com IA...');
      const { data, error } = await supabase.functions.invoke('analyze-contract', {
        body: { pdfText },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao analisar contrato');
      }

      // Fill form with extracted data
      const extracted = data.data;
      
      form.setValue('title', extracted.title || '');
      form.setValue('description', extracted.description || '');
      
      if (extracted.signatories && extracted.signatories.length > 0) {
        replace(extracted.signatories.map((s: any) => ({
          name: s.name || '',
          email: s.email || '',
        })));
      }

      toast.success('Contrato analisado! Revise os dados e complete os emails dos signatários.');
      setStep('form');
    } catch (error) {
      console.error('Error analyzing contract:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao analisar contrato');
    }

    setIsAnalyzing(false);
  };

  const skipAnalysis = () => {
    if (!file) {
      toast.error('Selecione um arquivo PDF primeiro');
      return;
    }
    setStep('form');
  };

  const computeFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const onSubmit = async (data: ContractForm) => {
    if (!user || !file) {
      toast.error('Arquivo PDF é obrigatório');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload PDF
      const documentHash = await computeFileHash(file);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(filePath, file);

      if (uploadError) {
        toast.error('Erro ao fazer upload do arquivo');
        setIsSubmitting(false);
        return;
      }

      // Create contract
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          owner_id: user.id,
          title: data.title,
          description: data.description || null,
          file_path: filePath,
          document_hash: documentHash,
          status: 'draft',
          signing_order: data.signingOrder,
          expires_at: data.expiresAt?.toISOString() || null,
        })
        .select()
        .single();

      if (contractError || !contract) {
        toast.error('Erro ao criar contrato');
        setIsSubmitting(false);
        return;
      }

      // Add signatories
      const signatoriesToInsert = data.signatories.map((s, index) => ({
        contract_id: contract.id,
        name: s.name,
        email: s.email,
        signing_order: data.signingOrder === 'sequential' ? index + 1 : 1,
      }));

      const { error: signatoryError } = await supabase
        .from('contract_signatories')
        .insert(signatoriesToInsert);

      if (signatoryError) {
        toast.error('Erro ao adicionar signatários');
        setIsSubmitting(false);
        return;
      }

      // Create audit log
      await supabase.from('audit_logs').insert({
        contract_id: contract.id,
        user_id: user.id,
        action: 'created',
        ip_address: 'N/A',
        user_agent: navigator.userAgent,
        metadata: { signatories: data.signatories.length },
      });

      toast.success('Contrato criado com sucesso!');
      navigate(`/contracts/${contract.id}`);
    } catch (error) {
      toast.error('Erro inesperado ao criar contrato');
    }

    setIsSubmitting(false);
  };

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
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Novo Contrato</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
            step === 'upload' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {step === 'form' ? <CheckCircle2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            <span className="text-sm font-medium">1. Upload</span>
          </div>
          <div className="w-8 h-0.5 bg-primary/30" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
            step === 'form' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">2. Dados</span>
          </div>
        </div>

        {step === 'upload' && (
          <Card className="card-premium gold-border">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Upload do Contrato
              </CardTitle>
              <CardDescription>
                Faça upload do PDF e nossa IA irá preencher automaticamente os campos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  {file ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <CheckCircle2 className="h-8 w-8" />
                      </div>
                      <p className="font-medium text-primary">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Clique para trocar o arquivo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                      <div>
                        <p className="font-medium">Clique para fazer upload</p>
                        <p className="text-sm text-muted-foreground">ou arraste um PDF aqui</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PDF até 10MB
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {file && (
                <div className="space-y-3">
                  <Button 
                    onClick={analyzeContract} 
                    className="w-full btn-gold" 
                    size="lg"
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Analisando com IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analisar com IA e preencher automaticamente
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={skipAnalysis} 
                    variant="outline" 
                    className="w-full gold-border"
                    disabled={isAnalyzing}
                  >
                    Pular e preencher manualmente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'form' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Selected file indicator */}
              {file && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="flex items-center gap-3 py-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setStep('upload');
                        setFile(null);
                        form.reset();
                      }}
                    >
                      Trocar
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Contract Info */}
              <Card className="card-premium">
                <CardHeader>
                  <CardTitle>Informações do Contrato</CardTitle>
                  <CardDescription>
                    Revise e complete os dados do contrato
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Contrato de Prestação de Serviços" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descrição do contrato..." 
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="signingOrder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ordem de assinatura</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="parallel">Paralela (todos ao mesmo tempo)</SelectItem>
                              <SelectItem value="sequential">Sequencial (um de cada vez)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Define se todos podem assinar ao mesmo tempo ou em ordem
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expiresAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de expiração</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                                  ) : (
                                    <span>Selecione uma data</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormDescription>
                            Opcional - deixe em branco para sem expiração
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Signatories */}
              <Card className="card-premium">
                <CardHeader>
                  <CardTitle>Signatários</CardTitle>
                  <CardDescription>
                    Adicione as pessoas que devem assinar o contrato
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-4 items-start p-4 border border-primary/20 rounded-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0 gold-border">
                        {index + 1}
                      </div>
                      <div className="flex-1 grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`signatories.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome *</FormLabel>
                              <FormControl>
                                <Input placeholder="Nome completo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`signatories.${index}.email`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email *</FormLabel>
                              <FormControl>
                                <Input placeholder="email@exemplo.com" type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ name: '', email: '' })}
                    className="w-full gold-border"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar signatário
                  </Button>
                </CardContent>
              </Card>

              {/* Submit */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 btn-gold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Criando...
                    </>
                  ) : (
                    'Criar Contrato'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </main>
    </div>
  );
}
