import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSignature, Shield, Clock, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">SignDoc</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild>
                <Link to="/dashboard">
                  Acessar Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Começar grátis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Assinatura digital de contratos
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Crie, envie e assine contratos digitalmente com validade jurídica. 
          Simples, rápido e seguro.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link to="/auth">
              Começar agora
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline">
            Ver demonstração
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Tudo que você precisa
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <FileSignature className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Múltiplos signatários</CardTitle>
              <CardDescription>
                Adicione quantos signatários precisar, com ordem de assinatura personalizada
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Validade jurídica</CardTitle>
              <CardDescription>
                Trilha de auditoria completa com IP, data/hora e hash do documento
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
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
          Como funciona
        </h2>
        <div className="grid gap-8 md:grid-cols-4">
          {[
            { step: 1, title: 'Crie o contrato', desc: 'Faça upload do PDF ou use nosso editor' },
            { step: 2, title: 'Adicione signatários', desc: 'Informe quem deve assinar' },
            { step: 3, title: 'Envie para assinatura', desc: 'Cada um recebe seu link único' },
            { step: 4, title: 'Pronto!', desc: 'Documento assinado com certificado' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4">
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
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Crie sua conta gratuita e comece a enviar contratos para assinatura hoje mesmo.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/auth">
                Criar conta grátis
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              <span className="font-semibold">SignDoc</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 SignDoc. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
