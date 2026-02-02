
# Plano: Anexar PDF do Contrato nos Emails

## Resumo
Melhorar o fluxo de emails para que:
1. O **email de convite para assinatura** inclua o PDF do contrato anexado
2. O **email de confirmação de assinatura** inclua o contrato (quando houver arquivo)
3. O **email de conclusão** já envia certificado - podemos também anexar o contrato original

---

## Mudanças Necessárias

### 1. Edge Function: `send-signing-email`
**O que fazer:**
- Adicionar parâmetro opcional `pdfBase64` e `pdfFileName`
- Usar a API do Resend para enviar email com anexo
- O PDF será baixado do Storage antes de chamar a função

```text
Exemplo de anexo no Resend:
attachments: [{
  filename: 'contrato.pdf',
  content: pdfBase64 // base64 encoded
}]
```

### 2. Página: `ContractDetails.tsx`
**O que fazer:**
- Na função `sendForSigning()`, baixar o PDF do Storage
- Converter para base64
- Passar o PDF para a edge function junto com os outros dados

### 3. Edge Function: `send-signature-confirmation`
**O que fazer:**
- Adicionar parâmetros opcionais para anexar o contrato
- Buscar o arquivo do Storage usando service role
- Anexar ao email de confirmação

### 4. Edge Function: `send-all-completion-emails`
**O que fazer:**
- Já gera certificado em PDF
- Adicionar também o contrato original como segundo anexo (opcional)

---

## Fluxo Atualizado

```text
┌─────────────────────────────────────────────────────────────┐
│                    ENVIO DO CONTRATO                        │
├─────────────────────────────────────────────────────────────┤
│  1. Dono clica "Enviar para assinatura"                     │
│  2. Sistema baixa PDF do Storage                            │
│  3. Converte para base64                                    │
│  4. Envia email COM anexo do contrato                       │
│                                                             │
│  📧 Email: "Assinatura solicitada: [título]"               │
│  📎 Anexo: contrato.pdf                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   APÓS ASSINATURA                           │
├─────────────────────────────────────────────────────────────┤
│  1. Signatário assina o documento                           │
│  2. Sistema envia confirmação COM contrato anexado          │
│                                                             │
│  📧 Email: "✅ Assinatura registrada: [título]"            │
│  📎 Anexo: contrato.pdf                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              QUANDO TODOS ASSINAM                           │
├─────────────────────────────────────────────────────────────┤
│  1. Último signatário assina                                │
│  2. Sistema envia email de conclusão                        │
│                                                             │
│  📧 Email: "✅ Contrato concluído: [título]"               │
│  📎 Anexo 1: certificado.pdf (trilha de auditoria)         │
│  📎 Anexo 2: contrato.pdf (documento original)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Modificações nos Arquivos

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/send-signing-email/index.ts` | Adicionar suporte a anexo PDF |
| `supabase/functions/send-signature-confirmation/index.ts` | Buscar e anexar contrato do Storage |
| `supabase/functions/send-all-completion-emails/index.ts` | Anexar contrato original além do certificado |
| `src/pages/ContractDetails.tsx` | Baixar PDF e converter para base64 antes de enviar |

### Limitações a Considerar
- **Tamanho do email**: Resend tem limite de ~25MB por email
- **Performance**: Download do PDF adiciona latência
- **Contratos sem arquivo**: Alguns contratos podem não ter PDF anexado - tratamento gracioso

### Segurança
- As edge functions usam `service_role` para acessar Storage
- PDFs só são anexados se existirem no contrato
- Validação de token mantida em todas as funções

---

## Resultado Esperado

✅ Signatário recebe o contrato para ler no email de convite  
✅ Signatário recebe cópia do contrato após assinar  
✅ Todos recebem contrato + certificado quando concluído
