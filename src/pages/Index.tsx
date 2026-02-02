import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileSignature, Shield, Clock, ArrowRight, Loader2, Quote } from 'lucide-react';
import logoTransparent from '@/assets/logo-transparent.png';
import sidneyPhoto from '@/assets/sidney-regozoni.png';
import heroVideo from '@/assets/hero-video.mp4';

export default function Index() {
  const { user, loading } = useAuth();

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/90 to-transparent backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img 
              src={logoTransparent} 
              alt="Regozoni Docs" 
              className="h-12 w-auto"
            />
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild className="btn-gold">
                <Link to="/dashboard">
                  Acessar Painel
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="text-foreground/80 hover:text-foreground">
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button asChild className="btn-gold">
                  <Link to="/auth">Começar</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero with Video Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          {/* Dark overlay with gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-6 text-center">
          <div className="animate-fade-in">
            <div className="mb-8">
              <span className="inline-block px-5 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/30">
                Plataforma Jurídica Exclusiva
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 tracking-tight">
              <span className="gold-text">Governo Jurídico</span>
              <br />
              <span className="text-foreground">Digital</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              Menos improviso. Menos surpresa.
              <br />
              <span className="text-foreground font-medium">Mais controle sobre seus contratos.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="btn-gold text-lg px-8 py-6">
                <Link to="/auth">
                  Começar agora
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="gold-border text-lg px-8 py-6 bg-background/50 backdrop-blur-sm hover:bg-background/70"
                onClick={() => document.getElementById('sobre')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Conhecer o idealizador
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-primary/50 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/50 to-background" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="gold-text">Recursos</span> que fazem diferença
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Tecnologia de ponta a serviço da segurança jurídica
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <Card className="card-premium hover:gold-glow transition-all duration-500 group border-0">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 gold-border group-hover:scale-110 transition-transform duration-300">
                  <FileSignature className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Múltiplos signatários</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Adicione quantos signatários precisar, com ordem de assinatura personalizada e rastreamento individual
                </p>
              </CardContent>
            </Card>

            <Card className="card-premium hover:gold-glow transition-all duration-500 group border-0">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 gold-border group-hover:scale-110 transition-transform duration-300">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Validade jurídica</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Trilha de auditoria completa com IP, data/hora, hash do documento e certificado de conclusão
                </p>
              </CardContent>
            </Card>

            <Card className="card-premium hover:gold-glow transition-all duration-500 group border-0">
              <CardContent className="pt-8 pb-8 px-8">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 gold-border group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Processo simplificado</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Assine de qualquer lugar, desenhando ou digitando seu nome. Sem complicação, sem burocracia
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* About Section - Sidney Regozoni */}
      <section id="sobre" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-card via-background to-card" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            {/* Photo */}
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500" />
              <div className="relative overflow-hidden rounded-2xl gold-border">
                <img 
                  src={sidneyPhoto} 
                  alt="Sidney Regozoni" 
                  className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="gold-text text-2xl font-bold">Sidney Regozoni</p>
                  <p className="text-muted-foreground">Advogado e Estrategista Jurídico</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-8">
              <div>
                <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary gold-border mb-6">
                  O Idealizador
                </span>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                  O jurídico só funciona quando
                  <span className="gold-text"> deixa de ser reativo</span>
                </h2>
              </div>

              <div className="relative pl-6 border-l-2 border-primary/30">
                <Quote className="absolute -left-4 -top-2 h-8 w-8 text-primary/30" />
                <p className="text-lg text-muted-foreground leading-relaxed italic">
                  "Pessoas e empresas só procuram um advogado quando o problema já está caro, exposto e fora de controle. O resultado quase sempre é o mesmo: decisões tomadas sob pressão, riscos mal avaliados e custos muito maiores do que o necessário."
                </p>
              </div>

              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Este sistema nasce para <span className="text-foreground font-medium">romper com esse modelo</span>. Em vez de agir apenas quando o conflito estoura, a proposta é oferecer acompanhamento jurídico contínuo, com foco em <span className="text-foreground font-medium">prevenção, leitura de cenário, organização de decisões e proteção patrimonial</span>.
                </p>
                <p>
                  Sidney não trabalha com promessas, slogans ou soluções genéricas. Sua abordagem é baseada em <span className="text-foreground font-medium">método, sobriedade e responsabilidade</span>. Cada orientação parte da análise de risco, do impacto real das decisões e do custo de não agir com clareza.
                </p>
              </div>

              <div className="pt-4">
                <Card className="card-premium gold-border bg-primary/5">
                  <CardContent className="py-6 px-6">
                    <p className="text-foreground font-medium text-lg text-center">
                      Previsibilidade, controle e tranquilidade jurídica são <span className="gold-text">ativos estratégicos</span>.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
        <div className="container mx-auto px-6 relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">
            Como <span className="gold-text">funciona</span>
          </h2>
          <div className="grid gap-8 md:grid-cols-4 max-w-5xl mx-auto">
            {[
              { step: 1, title: 'Crie o contrato', desc: 'Faça upload do PDF ou use nosso editor integrado' },
              { step: 2, title: 'Adicione signatários', desc: 'Informe quem deve assinar e em qual ordem' },
              { step: 3, title: 'Envie para assinatura', desc: 'Cada signatário recebe seu link único e seguro' },
              { step: 4, title: 'Documento certificado', desc: 'Assinatura completa com trilha de auditoria' },
            ].map((item, index) => (
              <div key={item.step} className="text-center group">
                <div className="relative mb-6">
                  <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground font-bold text-2xl flex items-center justify-center mx-auto gold-glow group-hover:scale-110 transition-transform duration-300">
                    {item.step}
                  </div>
                  {index < 3 && (
                    <div className="hidden md:block absolute top-1/2 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                  )}
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Pronto para ter
              <br />
              <span className="gold-text">governo jurídico</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Menos improviso, menos surpresa, mais controle sobre seus documentos.
            </p>
            <Button size="lg" asChild className="btn-gold text-lg px-10 py-7">
              <Link to="/auth">
                Acessar a plataforma
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/20 bg-card/50">
        <div className="container mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <img 
              src={logoTransparent} 
              alt="Regozoni Docs" 
              className="h-10 w-auto opacity-80"
            />
            <p className="text-sm text-muted-foreground">
              © 2024 Dr. Sidney Regozoni. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
