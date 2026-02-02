

## Reenvio de Emails + Corpo Inteligente com IA

### Visao Geral

Implementar funcionalidade de reenvio de emails para signatarios pendentes, com corpo de email gerado por IA que analisa o contrato e cria uma mensagem profissional e persuasiva.

### Novas Funcionalidades

**1. Botao "Reenviar emails"**
- Aparece quando contrato esta em status `pending` ou `partially_signed`
- Envia email apenas para signatarios que ainda nao assinaram
- Registra audit log de reenvio

**2. Corpo de Email Inteligente**
- IA le o PDF do contrato
- Gera texto profissional em nome do cliente
- Tom formal e assertivo ("presenca")
- Menciona Regozoni Docs como plataforma

### Estrutura do Email Gerado pela IA

```text
Exemplo de corpo gerado:

"Prezado(a) [Nome do Signatario],

A Regozoni Docs, em nome de [Nome do Cliente/Empresa], 
apresenta para sua apreciacao e assinatura o seguinte documento:

[Titulo do Contrato]

Este contrato estabelece [resumo gerado pela IA do objeto do contrato].
Solicitamos sua assinatura para dar seguimento aos tramites legais.

Voce tem ate [prazo se houver] para realizar a assinatura.

Clique no botao abaixo para acessar o documento e assinar digitalmente."
```

### Arquivos a Modificar/Criar

**1. supabase/functions/generate-email-body/index.ts** (NOVA)
- Recebe: texto do PDF, titulo, nome do cliente, nome do signatario
- Usa IA (Gemini) para gerar corpo profissional
- Retorna HTML formatado para o email

**2. supabase/functions/send-signing-email/index.ts** (ATUALIZAR)
- Adicionar campo opcional `customBody` para corpo gerado pela IA
- Manter template atual como fallback

**3. src/pages/ContractDetails.tsx** (ATUALIZAR)
- Adicionar estado `resending`
- Criar funcao `resendEmails()` que:
  - Busca texto do PDF do storage
  - Chama edge function para gerar corpo do email
  - Envia emails com corpo personalizado
- Adicionar botao "Reenviar emails" na UI

### Detalhes Tecnicos

```text
Fluxo do Reenvio:
┌─────────────────────────────────────────────────────┐
│  1. Usuario clica "Reenviar emails"                 │
├─────────────────────────────────────────────────────┤
│  2. Frontend busca PDF do Supabase Storage          │
│  3. Extrai texto do PDF (pdfjs-dist)                │
├─────────────────────────────────────────────────────┤
│  4. Chama generate-email-body com:                  │
│     - pdfText                                       │
│     - contractTitle                                 │
│     - senderName (dono do contrato)                 │
│     - signatoryName                                 │
├─────────────────────────────────────────────────────┤
│  5. IA retorna corpo personalizado                  │
├─────────────────────────────────────────────────────┤
│  6. Chama send-signing-email com customBody         │
├─────────────────────────────────────────────────────┤
│  7. Registra audit_logs: "email_resent"             │
└─────────────────────────────────────────────────────┘
```

### Prompt da IA para Gerar Email

```text
Voce e um assistente juridico da Regozoni Docs. Crie um corpo de email 
profissional, formal e assertivo para solicitar assinatura de contrato.

Contexto:
- Plataforma: Regozoni Docs (Dr. Sidney Regozoni)
- Cliente/Remetente: {senderName}
- Signatario: {signatoryName}
- Titulo do Contrato: {contractTitle}
- Conteudo do Contrato: {pdfText (resumido)}

Instrucoes:
1. Apresente a Regozoni Docs como plataforma oficial
2. Mencione que atua em nome do cliente
3. Resuma brevemente o objeto do contrato
4. Seja formal mas acolhedor
5. Transmita autoridade e profissionalismo
6. Maximo 150 palavras
7. Nao inclua saudacao final (sera adicionada automaticamente)
```

### Alteracoes na UI

**ContractDetails.tsx - Secao de Acoes:**

```text
Acoes disponiveis por status:
┌──────────────────────┬───────────────────────────────┐
│ Status               │ Botoes                        │
├──────────────────────┼───────────────────────────────┤
│ draft                │ [Enviar para assinatura]      │
│ pending              │ [Reenviar emails]             │
│ partially_signed     │ [Reenviar emails]             │
│ completed            │ [Baixar certificado]          │
└──────────────────────┴───────────────────────────────┘
```

### Registros de Auditoria

Novos action labels:
- `email_resent`: "Email reenviado"
- Metadata: { signatories_notified: number, ai_generated: boolean }

