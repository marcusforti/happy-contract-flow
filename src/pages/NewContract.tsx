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
import { ArrowLeft, Plus, Trash2, Upload, FileSignature, CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

export default function NewContract() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'signatories',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Apenas arquivos PDF são permitidos');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('Arquivo deve ter no máximo 10MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const computeFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const onSubmit = async (data: ContractForm) => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      let filePath = null;
      let documentHash = null;

      // Upload PDF if provided
      if (file) {
        documentHash = await computeFileHash(file);
        const fileExt = file.name.split('.').pop();
        filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('contracts')
          .upload(filePath, file);

        if (uploadError) {
          toast.error('Erro ao fazer upload do arquivo');
          setIsSubmitting(false);
          return;
        }
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
        ip_address: 'N/A', // Would need edge function to get real IP
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
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Novo Contrato</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informações do Contrato</CardTitle>
                <CardDescription>
                  Preencha os dados básicos do contrato
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
                          placeholder="Descrição opcional do contrato..." 
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* File Upload */}
                <div className="space-y-2">
                  <FormLabel>Documento PDF</FormLabel>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      {file ? (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <Upload className="h-5 w-5" />
                          <span>{file.name}</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Clique para fazer upload ou arraste um PDF
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Máximo 10MB
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

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
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Opcional - o contrato expira após esta data
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Signatories */}
            <Card>
              <CardHeader>
                <CardTitle>Signatários</CardTitle>
                <CardDescription>
                  Adicione as pessoas que devem assinar o contrato
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-4 items-start p-4 border rounded-lg">
                    <div className="flex-1 grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`signatories.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
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
                            <FormLabel>Email</FormLabel>
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
                        className="mt-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ name: '', email: '' })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar signatário
                </Button>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" asChild>
                <Link to="/dashboard">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Contrato
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
