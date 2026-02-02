import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSignature, Shield, Clock, CheckCircle, ArrowRight, Loader2, Scale } from 'lucide-react';

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
      <header className="border-b border-primary/20 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center gold-border">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-xl font-bold gold-text">Regozoni Docs</span>
              <p className="text-xs text-muted-foreground">Assinatura Digital</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild className="btn-gold">
                <Link to="/dashboard">
                  Acessar Painel
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
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

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="mb-6">
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary gold-border">
            Plataforma Exclusiva
          </span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          <span className="gold-text">Assinatura Digital</span>
          <br />
          <span className="text-foreground">de Contratos</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Crie, envie e assine contratos digitalmente com validade jurídica. 
          Ferramenta exclusiva para gestão profissional de documentos.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild className="btn-gold">
            <Link to="/auth">
              Começar agora
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="gold-border">
            Ver demonstração
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          <span className="gold-text">Recursos</span> Premium
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="card-premium hover:gold-glow transition-shadow">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 gold-border">
                <FileSignature className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Múltiplos signatários</CardTitle>
              <CardDescription>
                Adicione quantos signatários precisar, com ordem de assinatura personalizada
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="card-premium hover:gold-glow transition-shadow">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 gold-border">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Validade jurídica</CardTitle>
              <CardDescription>
                Trilha de auditoria completa com IP, data/hora e hash do documento
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="card-premium hover:gold-glow transition-shadow">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 gold-border">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Rápido e fácil</CardTitle>
              <CardDescription>
                Assine de qualquer lugar, desenhando ou digitando seu nome
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Como <span className="gold-text">funciona</span>
        </h2>
        <div className="grid gap-8 md:grid-cols-4">
          {[
            { step: 1, title: 'Crie o contrato', desc: 'Faça upload do PDF ou use nosso editor' },
            { step: 2, title: 'Adicione signatários', desc: 'Informe quem deve assinar' },
            { step: 3, title: 'Envie para assinatura', desc: 'Cada um recebe seu link único' },
            { step: 4, title: 'Pronto!', desc: 'Documento assinado com certificado' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4 gold-glow">
                {item.step}
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <Card className="card-premium gold-glow">
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Pronto para <span className="gold-text">começar</span>?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Acesse a plataforma e comece a enviar contratos para assinatura hoje mesmo.
            </p>
            <Button size="lg" asChild className="btn-gold">
              <Link to="/auth">
                Acessar plataforma
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/20 bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-primary" />
              <span className="font-semibold gold-text">Regozoni Docs</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Dr. Sidney Regozoni. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
