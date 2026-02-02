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
  FileSignature, 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  Search,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'pending' | 'partially_signed' | 'completed' | 'expired';
  created_at: string;
  expires_at: string | null;
}

const statusConfig = {
  draft: { label: 'Rascunho', icon: FileText, variant: 'secondary' as const },
  pending: { label: 'Aguardando', icon: Clock, variant: 'outline' as const },
  partially_signed: { label: 'Parcialmente assinado', icon: AlertCircle, variant: 'default' as const },
  completed: { label: 'Concluído', icon: CheckCircle2, variant: 'default' as const },
  expired: { label: 'Expirado', icon: AlertCircle, variant: 'destructive' as const },
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
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">SignDoc</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {profile?.full_name || user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de contratos</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-3xl text-amber-600">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Concluídos</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Button asChild className="sm:w-auto">
            <Link to="/contracts/new">
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Link>
          </Button>
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contratos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="pending">Aguardando</SelectItem>
                <SelectItem value="partially_signed">Parcialmente assinado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contracts List */}
        {loadingContracts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredContracts.length === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum contrato encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {contracts.length === 0 
                  ? 'Crie seu primeiro contrato para começar' 
                  : 'Tente ajustar os filtros de busca'}
              </p>
              {contracts.length === 0 && (
                <Button asChild>
                  <Link to="/contracts/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Contrato
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredContracts.map((contract) => {
              const config = statusConfig[contract.status];
              const StatusIcon = config.icon;
              return (
                <Card key={contract.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{contract.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Criado em {format(new Date(contract.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={config.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                      <Button variant="outline" asChild>
                        <Link to={`/contracts/${contract.id}`}>Ver detalhes</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
