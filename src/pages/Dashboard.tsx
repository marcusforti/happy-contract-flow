import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Trash2,
  TrendingUp,
  Users,
  FileSignature,
  X,
  ArrowUpDown,
  Filter,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import type { RealtimePostgresUpdatePayload } from '@supabase/supabase-js';
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
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { ContractProgressBar } from '@/components/dashboard/ContractProgressBar';
import { ExpirationBadge } from '@/components/dashboard/ExpirationBadge';
import { useDebounce } from '@/hooks/useDebounce';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

interface Signatory {
  id: string;
  name: string;
  email: string;
  signed_at: string | null;
}

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'pending' | 'partially_signed' | 'completed' | 'expired';
  created_at: string;
  expires_at: string | null;
  contract_signatories?: Signatory[];
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'status';

const statusConfig = {
  draft: { label: 'Rascunho', icon: FileText, color: 'bg-muted text-muted-foreground' },
  pending: { label: 'Aguardando', icon: Clock, color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  partially_signed: { label: 'Em andamento', icon: AlertCircle, color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  completed: { label: 'Concluído', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  expired: { label: 'Expirado', icon: AlertCircle, color: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const sortOptions = {
  date_desc: 'Mais recentes',
  date_asc: 'Mais antigos',
  name_asc: 'Nome (A-Z)',
  name_desc: 'Nome (Z-A)',
  status: 'Por status',
};

const SORT_STORAGE_KEY = 'dashboard_sort_preference';

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    return (saved as SortOption) || 'date_desc';
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

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

  // Realtime subscription for contracts and signatories
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contracts',
        },
        (payload: RealtimePostgresUpdatePayload<Contract>) => {
          const newContract = payload.new;
          
          setContracts(prev => 
            prev.map(c => c.id === newContract.id 
              ? { ...c, ...newContract } 
              : c
            )
          );
          
          // Toast de celebração quando contrato é concluído
          if (newContract.status === 'completed') {
            toast.success(`🎉 Contrato "${newContract.title}" foi concluído!`, {
              duration: 5000,
            });
          } else if (newContract.status === 'partially_signed') {
            toast.info(`✍️ Nova assinatura em "${newContract.title}"`, {
              duration: 3000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contract_signatories',
        },
        () => {
          // Refetch para atualizar a barra de progresso
          fetchContracts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, sortBy);
  }, [sortBy]);

  const fetchContracts = async () => {
    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        contract_signatories (
          id,
          name,
          email,
          signed_at
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContracts(data);
    }
    setLoadingContracts(false);
  };

  const handleDeleteContract = async (contractId: string) => {
    setDeletingId(contractId);
    
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
      setDeletingId(null);
      return;
    }

    toast.success('Contrato excluído com sucesso');
    
    // Animação de saída antes de remover
    setTimeout(() => {
      setContracts(contracts.filter(c => c.id !== contractId));
      setDeletingId(null);
    }, 300);
  };

  const handleStatsClick = (filter: string) => {
    setStatusFilter(filter);
    setSearchTerm('');
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const filteredAndSortedContracts = useMemo(() => {
    let filtered = contracts.filter(contract => {
      const matchesSearch = contract.title.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'pending_all' 
          ? (contract.status === 'pending' || contract.status === 'partially_signed')
          : contract.status === statusFilter);
      return matchesSearch && matchesStatus;
    });

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name_asc':
          return a.title.localeCompare(b.title);
        case 'name_desc':
          return b.title.localeCompare(a.title);
        case 'status':
          const statusOrder = ['pending', 'partially_signed', 'draft', 'completed', 'expired'];
          return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  }, [contracts, debouncedSearch, statusFilter, sortBy]);

  const stats = useMemo(() => ({
    total: contracts.length,
    pending: contracts.filter(c => c.status === 'pending' || c.status === 'partially_signed').length,
    completed: contracts.filter(c => c.status === 'completed').length,
  }), [contracts]);

  const getEmptyStateContent = () => {
    if (contracts.length === 0) {
      return {
        icon: <Sparkles className="h-10 w-10 text-primary" />,
        title: 'Crie seu primeiro contrato',
        description: 'Comece agora e experimente o poder da assinatura digital segura.',
        showCTA: true,
        ctaText: 'Criar meu primeiro contrato'
      };
    }
    
    if (statusFilter !== 'all' && filteredAndSortedContracts.length === 0) {
      const filterLabels: Record<string, string> = {
        pending_all: 'pendentes',
        completed: 'concluídos',
        draft: 'em rascunho',
        expired: 'expirados'
      };
      return {
        icon: <Filter className="h-10 w-10 text-muted-foreground" />,
        title: 'Nenhum contrato encontrado',
        description: `Você não tem contratos ${filterLabels[statusFilter] || 'com esse status'}.`,
        showCTA: false,
        showClearFilter: true
      };
    }
    
    if (debouncedSearch && filteredAndSortedContracts.length === 0) {
      return {
        icon: <Search className="h-10 w-10 text-muted-foreground" />,
        title: 'Sem resultados',
        description: `Nenhum contrato encontrado para "${debouncedSearch}".`,
        showCTA: false,
        showClearFilter: true
      };
    }

    if (stats.completed === stats.total && stats.total > 0) {
      return {
        icon: <CheckCircle2 className="h-10 w-10 text-emerald-500" />,
        title: 'Parabéns! 🎉',
        description: 'Todos os seus contratos foram concluídos com sucesso.',
        showCTA: true,
        ctaText: 'Criar novo contrato'
      };
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-primary/20 bg-card/95 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-between px-6 py-4">
            <img src={logoTransparent} alt="Regozoni Docs" className="h-10 w-auto" />
          </div>
        </header>
        <main className="container mx-auto px-6 py-8">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="sticky top-0 z-50 border-b border-primary/20 bg-card/95 backdrop-blur-sm"
      >
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src={logoTransparent} 
              alt="Regozoni Docs" 
              className="h-8 sm:h-10 w-auto"
            />
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
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
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </motion.header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Welcome Section */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-6 sm:mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">
            Olá, <span className="gold-text">{profile?.full_name?.split(' ')[0] || 'Usuário'}</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie seus contratos com segurança jurídica.
          </p>
        </motion.div>

        {/* Stats Cards - Clicáveis */}
        {loadingContracts ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-6 sm:mb-10">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="card-premium">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-2">
                      <div className="h-3 sm:h-4 w-16 sm:w-24 bg-muted rounded animate-pulse" />
                      <div className="h-6 sm:h-8 w-10 sm:w-16 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-8 sm:h-12 sm:w-12 rounded-lg bg-muted animate-pulse hidden sm:block" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="grid grid-cols-3 gap-2 sm:gap-6 mb-6 sm:mb-10"
          >
            <motion.div variants={itemVariants}>
              <Card 
                className={`card-premium group cursor-pointer transition-all duration-300 ${
                  statusFilter === 'all' ? 'gold-glow ring-2 ring-primary/50' : 'hover:gold-glow'
                }`}
                onClick={() => handleStatsClick('all')}
              >
                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] sm:text-sm font-medium">Total</CardDescription>
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center gold-border"
                    >
                      <FileSignature className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-primary" />
                    </motion.div>
                  </div>
                  <CardTitle className="text-2xl sm:text-4xl font-bold gold-text">{stats.total}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 hidden sm:block">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    Documentos
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card 
                className={`card-premium group cursor-pointer transition-all duration-300 ${
                  statusFilter === 'pending_all' ? 'ring-2 ring-amber-500/50' : 'hover:gold-glow'
                }`}
                onClick={() => handleStatsClick('pending_all')}
              >
                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] sm:text-sm font-medium">Pendentes</CardDescription>
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/30"
                    >
                      <Clock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-amber-500" />
                    </motion.div>
                  </div>
                  <CardTitle className="text-2xl sm:text-4xl font-bold text-amber-500">{stats.pending}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 hidden sm:block">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3 text-amber-500" />
                    Aguardando
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card 
                className={`card-premium group cursor-pointer transition-all duration-300 ${
                  statusFilter === 'completed' ? 'ring-2 ring-emerald-500/50' : 'hover:gold-glow'
                }`}
                onClick={() => handleStatsClick('completed')}
              >
                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[10px] sm:text-sm font-medium">Concluídos</CardDescription>
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-emerald-500" />
                    </motion.div>
                  </div>
                  <CardTitle className="text-2xl sm:text-4xl font-bold text-emerald-500">{stats.completed}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 hidden sm:block">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Assinados
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 mb-6 sm:mb-8"
        >
          <motion.div variants={itemVariants}>
            <Button 
              asChild 
              className="btn-gold h-11 sm:h-14 justify-start px-4 sm:px-5 group w-full"
            >
              <Link to="/contracts/new">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                <span className="font-medium text-sm sm:text-base">Novo Contrato</span>
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all hidden sm:block" />
              </Link>
            </Button>
          </motion.div>
          
          <motion.div variants={itemVariants} className="hidden sm:block">
            <Button 
              variant="outline"
              className={`h-14 justify-start px-5 gold-border hover:bg-primary/5 w-full ${
                statusFilter === 'pending_all' ? 'bg-primary/10' : ''
              }`}
              onClick={() => handleStatsClick(statusFilter === 'pending_all' ? 'all' : 'pending_all')}
            >
              <Clock className="h-5 w-5 mr-3 text-amber-500" />
              <span className="font-medium">Pendentes</span>
              {stats.pending > 0 && (
                <Badge className="ml-auto bg-amber-500/20 text-amber-500 border-amber-500/30">
                  {stats.pending}
                </Badge>
              )}
            </Button>
          </motion.div>
          
          <motion.div variants={itemVariants} className="hidden sm:block">
            <Button 
              variant="outline"
              className={`h-14 justify-start px-5 gold-border hover:bg-primary/5 w-full ${
                statusFilter === 'completed' ? 'bg-primary/10' : ''
              }`}
              onClick={() => handleStatsClick(statusFilter === 'completed' ? 'all' : 'completed')}
            >
              <CheckCircle2 className="h-5 w-5 mr-3 text-emerald-500" />
              <span className="font-medium">Concluídos</span>
              {stats.completed > 0 && (
                <Badge className="ml-auto bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                  {stats.completed}
                </Badge>
              )}
            </Button>
          </motion.div>
        </motion.div>

        {/* Search & Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 sm:mb-8"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 sm:pl-11 pr-10 h-10 sm:h-11 bg-card border-primary/20 focus:border-primary/50 text-sm"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:w-[150px] h-10 sm:h-11 bg-card border-primary/20 text-sm">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="pending">Aguardando</SelectItem>
                <SelectItem value="partially_signed">Em andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="flex-1 sm:w-[150px] h-10 sm:h-11 bg-card border-primary/20 text-sm">
                <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sortOptions).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Section Title */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6"
        >
          <div className="h-6 sm:h-8 w-1 bg-primary rounded-full" />
          <h2 className="text-base sm:text-xl font-semibold">Seus Contratos</h2>
          <span className="text-xs sm:text-sm text-muted-foreground">({filteredAndSortedContracts.length})</span>
          {(statusFilter !== 'all' || debouncedSearch) && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground hover:text-foreground text-xs sm:text-sm h-8 px-2 sm:px-3"
              onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Limpar filtros</span>
              <span className="sm:hidden">Limpar</span>
            </Button>
          )}
        </motion.div>

        {/* Contracts List */}
        {loadingContracts ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="card-premium">
                <CardHeader className="p-4 sm:pb-3">
                  <div className="space-y-2">
                    <div className="h-4 sm:h-5 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-3 sm:h-4 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="h-5 sm:h-6 w-20 bg-muted rounded-full animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedContracts.length === 0 ? (
          (() => {
            const emptyState = getEmptyStateContent();
            if (!emptyState) return null;
            
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="py-10 sm:py-16 card-premium border-dashed">
                  <CardContent className="text-center px-4">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 sm:mb-6 gold-border"
                    >
                      {emptyState.icon}
                    </motion.div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-2">{emptyState.title}</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-md mx-auto">
                      {emptyState.description}
                    </p>
                    {emptyState.showCTA && (
                      <Button asChild size="default" className="btn-gold">
                        <Link to="/contracts/new">
                          <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          {emptyState.ctaText}
                        </Link>
                      </Button>
                    )}
                    {emptyState.showClearFilter && (
                      <Button 
                        variant="outline" 
                        size="default" 
                        className="gold-border"
                        onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
                      >
                        <X className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        Limpar filtros
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {filteredAndSortedContracts.map((contract) => {
                const config = statusConfig[contract.status];
                const StatusIcon = config.icon;
                const isDeleting = deletingId === contract.id;
                
                return (
                  <motion.div
                    key={contract.id}
                    variants={cardVariants}
                    initial="hidden"
                    animate={isDeleting ? "exit" : "visible"}
                    exit="exit"
                    layout
                  >
                    <Card className="card-premium hover:gold-glow transition-all duration-300 group h-full">
                      <CardHeader className="p-4 sm:p-6 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base font-semibold truncate group-hover:text-primary transition-colors">
                              {contract.title}
                            </CardTitle>
                            <CardDescription className="text-[11px] sm:text-xs mt-1">
                              {format(new Date(contract.created_at), "d 'de' MMM, yyyy", { locale: ptBR })}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                            <ExpirationBadge 
                              expiresAt={contract.expires_at} 
                              status={contract.status} 
                            />
                            <Badge 
                              variant="outline" 
                              className={`flex items-center gap-1 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 ${config.color}`}
                            >
                              <StatusIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              <span className="hidden sm:inline">{config.label}</span>
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-4 sm:p-6 pt-0 space-y-3 sm:space-y-4">
                        {/* Progress Bar */}
                        {contract.contract_signatories && contract.contract_signatories.length > 0 && (
                          <ContractProgressBar signatories={contract.contract_signatories} />
                        )}
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                          <Button 
                            variant="outline" 
                            size="sm"
                            asChild 
                            className="flex-1 gold-border hover:bg-primary/10 h-8 sm:h-9 text-xs sm:text-sm"
                          >
                            <Link to={`/contracts/${contract.id}`}>Ver detalhes</Link>
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="card-premium border-primary/20 mx-4 sm:mx-0">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-base sm:text-lg">Excluir contrato</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                  Tem certeza que deseja excluir o contrato <span className="text-foreground font-medium">"{contract.title}"</span>? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                                <AlertDialogCancel className="gold-border">Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteContract(contract.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="border-t border-primary/20 bg-card/50 mt-auto"
      >
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <img 
              src={logoTransparent} 
              alt="Regozoni Docs" 
              className="h-6 sm:h-8 w-auto opacity-60"
            />
            <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
              © 2024 Dr. Sidney Regozoni. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
