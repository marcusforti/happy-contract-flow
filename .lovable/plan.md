

## Branding Exclusivo - Dr. Sidney Regozoni

### Visao Geral

Transformacao completa da identidade visual da plataforma SignDoc para criar uma ferramenta exclusiva e premium alinhada com a marca pessoal do Dr. Sidney Regozoni.

### Paleta de Cores

Baseada no perfil do Instagram do cliente:

| Elemento | Cor Atual | Nova Cor (HSL) |
|----------|-----------|----------------|
| Background | Branco | Preto profundo (#0A0A0A) |
| Foreground | Escuro | Branco/Cinza claro |
| Primary | Azul escuro | Dourado (#D4AF37) |
| Accent | Cinza | Dourado escuro (#B8860B) |
| Cards | Branco | Cinza escuro (#1A1A1A) |
| Borders | Cinza claro | Cinza escuro/Dourado sutil |

### Identidade da Marca

**Nome Sugerido**: "Regozoni Docs" ou "Smart Legal Sign" (baseado no logo SMART que aparece nos videos)

**Elementos**:
- Logo customizado com as iniciais "SR" ou escudo juridico
- Tipografia elegante e profissional
- Icones com bordas douradas sutis

### Arquivos a Modificar

**1. src/index.css** - Sistema de cores
- Remover tema claro (deixar apenas dark mode)
- Redefinir todas as variaveis CSS para a nova paleta
- Adicionar gradientes dourados

**2. src/pages/Index.tsx** - Landing Page
- Novo header com logo/nome personalizado
- Hero section com visual premium
- Features cards com bordas douradas
- Footer com creditos "by Sidney Regozoni"

**3. src/pages/Auth.tsx** - Pagina de Login
- Card com borda dourada sutil
- Logo personalizado no topo
- Visual mais elegante

**4. src/pages/Dashboard.tsx** - Painel Principal
- Header com marca personalizada
- Cards com visual premium
- Estatisticas com destaque dourado

**5. src/pages/SigningPage.tsx** - Pagina de Assinatura
- Branding visivel para quem recebe o contrato
- Visual profissional e confiavel

**6. Outros arquivos**
- ContractDetails.tsx
- NewContract.tsx

### Detalhes Tecnicos

```text
Nova Paleta CSS:
┌─────────────────────────────────────────┐
│  :root (Dark Mode Only)                 │
├─────────────────────────────────────────┤
│  --background: 0 0% 4%      (#0A0A0A)   │
│  --foreground: 0 0% 95%     (#F2F2F2)   │
│  --card: 0 0% 8%            (#141414)   │
│  --primary: 43 76% 52%      (#D4AF37)   │
│  --accent: 43 76% 38%       (#B8860B)   │
│  --muted: 0 0% 15%          (#262626)   │
│  --border: 43 30% 20%       (Gold hint) │
└─────────────────────────────────────────┘
```

### Recursos Adicionais

**Gradientes Premium**:
- Background com gradiente sutil preto/cinza escuro
- Botoes com gradiente dourado
- Bordas com brilho dourado sutil

**Efeitos Visuais**:
- Hover states com brilho dourado
- Sombras sutis douradas em cards importantes
- Transicoes suaves

### Proximos Passos

1. Definir nome final da marca (sugestoes: "Regozoni Docs", "Smart Legal", "SR Sign")
2. Implementar nova paleta de cores no CSS
3. Atualizar todas as paginas com a nova identidade
4. Adicionar logo/icone personalizado (se fornecido)

### Pergunta para o Usuario

Qual nome voce prefere para a ferramenta?
- **Regozoni Docs** - direto ao ponto, sua marca
- **Smart Legal Sign** - baseado no "Smart" que aparece no seu conteudo
- **SR Sign** - minimalista com suas iniciais
- **Outro nome** - me diga qual prefere

