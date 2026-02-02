import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  Search,
  Loader2,
  Trash2,
  TrendingUp,
  Users,
  FileSignature
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoTransparent from '@/assets/logo-transparent.png';

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'pending' | 'partially_signed' | 'completed' | 'expired';
  created_at: string;
  expires_at: string | null;
}

const statusConfig = {
  draft: { label: 'Rascunho', icon: FileText, color: 'bg-muted text-muted-foreground' },
  pending: { label: 'Aguardando', icon: Clock, color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  partially_signed: { label: 'Em andamento', icon: AlertCircle, color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  completed: { label: 'Concluído', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  expired: { label: 'Expirado', icon: AlertCircle, color: 'bg-destructive/10 text-destructive border-destructive/30' },
};

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchContracts();
    }
  }, [user]);

  const fetchContracts = async () => {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContracts(data);
    }
    setLoadingContracts(false);
  };

  const handleDeleteContract = async (contractId: string) => {
    const { data: fields } = await supabase
      .from('signature_fields')
      .select('id')
      .eq('contract_id', contractId);
    
    if (fields && fields.length > 0) {
      const fieldIds = fields.map(f => f.id);
      await supabase.from('signatures').delete().in('field_id', fieldIds);
    }
    
    await supabase.from('signature_fields').delete().eq('contract_id', contractId);
    await supabase.from('audit_logs').delete().eq('contract_id', contractId);
    await supabase.from('contract_signatories').delete().eq('contract_id', contractId);
    
    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId);

    if (error) {
      toast.error('Erro ao excluir contrato');
      console.error(error);
      return;
    }

    toast.success('Contrato excluído com sucesso');
    setContracts(contracts.filter(c => c.id !== contractId));
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: contracts.length,
    pending: contracts.filter(c => c.status === 'pending' || c.status === 'partially_signed').length,
    completed: contracts.filter(c => c.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src={logoTransparent} 
              alt="Regozoni Docs" 
              className="h-10 w-auto"
            />
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {profile?.full_name || user?.email}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Olá, <span className="gold-text">{profile?.full_name?.split(' ')[0] || 'Usuário'}</span>
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus contratos com total controle e segurança jurídica.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-10">
          <Card className="card-premium group hover:gold-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Total de contratos</CardDescription>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center gold-border group-hover:scale-110 transition-transform">
                  <FileSignature className="h-5 w-5 text-primary" />
                </div>
              </div>
              <CardTitle className="text-4xl font-bold gold-text">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                Documentos criados
              </p>
            </CardContent>
          </Card>

          <Card className="card-premium group hover:gold-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Pendentes</CardDescription>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition-transform">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <CardTitle className="text-4xl font-bold text-amber-500">{stats.pending}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3 text-amber-500" />
                Aguardando assinaturas
              </p>
            </CardContent>
          </Card>

          <Card className="card-premium group hover:gold-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Concluídos</CardDescription>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
              <CardTitle className="text-4xl font-bold text-emerald-500">{stats.completed}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Totalmente assinados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <Button asChild size="lg" className="btn-gold lg:w-auto">
            <Link to="/contracts/new">
              <Plus className="h-5 w-5 mr-2" />
              Novo Contrato
            </Link>
          </Button>
          
          <div className="flex flex-1 gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contratos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-11 bg-card border-primary/20 focus:border-primary/50"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px] h-11 bg-card border-primary/20">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="pending">Aguardando</SelectItem>
                <SelectItem value="partially_signed">Em andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Section Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-1 bg-primary rounded-full" />
          <h2 className="text-xl font-semibold">Seus Contratos</h2>
          <span className="text-sm text-muted-foreground">({filteredContracts.length})</span>
        </div>

        {/* Contracts List */}
        {loadingContracts ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredContracts.length === 0 ? (
          <Card className="py-16 card-premium border-dashed">
            <CardContent className="text-center">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 gold-border">
                <FileText className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhum contrato encontrado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {contracts.length === 0 
                  ? 'Comece criando seu primeiro contrato e experimente o poder da assinatura digital.' 
                  : 'Tente ajustar os filtros de busca para encontrar o que procura.'}
              </p>
              {contracts.length === 0 && (
                <Button asChild size="lg" className="btn-gold">
                  <Link to="/contracts/new">
                    <Plus className="h-5 w-5 mr-2" />
                    Criar meu primeiro contrato
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredContracts.map((contract, index) => {
              const config = statusConfig[contract.status];
              const StatusIcon = config.icon;
              return (
                <Card 
                  key={contract.id} 
                  className="card-premium hover:gold-glow transition-all duration-300 group animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center gold-border group-hover:scale-105 transition-transform">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {contract.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Criado em {format(new Date(contract.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 sm:gap-4">
                      <Badge 
                        variant="outline" 
                        className={`flex items-center gap-1.5 px-3 py-1.5 ${config.color}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {config.label}
                      </Badge>
                      
                      <Button 
                        variant="outline" 
                        asChild 
                        className="gold-border hover:bg-primary/10"
                      >
                        <Link to={`/contracts/${contract.id}`}>Ver detalhes</Link>
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="card-premium border-primary/20">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o contrato <span className="text-foreground font-medium">"{contract.title}"</span>? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="gold-border">Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteContract(contract.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir permanentemente
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-primary/20 bg-card/50 mt-auto">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <img 
              src={logoTransparent} 
              alt="Regozoni Docs" 
              className="h-8 w-auto opacity-60"
            />
            <p className="text-xs text-muted-foreground">
              © 2024 Dr. Sidney Regozoni. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
