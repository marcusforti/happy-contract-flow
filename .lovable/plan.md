

# Plano: Certificado por Email para Todos os Signatários

## Visão Geral

Quando o contrato for concluído (todos assinarem), cada signatário receberá:
1. **Email de conclusão** (já existe)
2. **Certificado HTML anexado** ao email (novo)
3. **Link para baixar** o certificado na plataforma (novo)

---

## Situação Atual

| Funcionalidade | Status |
|----------------|--------|
| Download do certificado em ContractDetails | ✅ Existe |
| Email de conclusão para signatários | ✅ Existe |
| Certificado anexado ao email | ❌ Não existe |

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                 Última assinatura coletada                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   send-all-completion-emails  │
              └───────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
     ┌──────────┐       ┌──────────┐       ┌──────────┐
     │ João     │       │ Maria    │       │ Pedro    │
     │ Email +  │       │ Email +  │       │ Email +  │
     │ Anexo    │       │ Anexo    │       │ Anexo    │
     └──────────┘       └──────────┘       └──────────┘
           │                  │                  │
           └────────> certificado-contrato.html <────────┘
```

---

## Implementação Técnica

### Modificar `send-all-completion-emails`

A edge function será atualizada para:

1. **Buscar dados completos** do contrato, signatários, assinaturas (com IP/user_agent) e audit logs
2. **Gerar o HTML do certificado** (mesmo template usado no frontend)
3. **Anexar o certificado** como arquivo HTML no email via Resend
4. **Incluir CTA** com link para ver detalhes na plataforma

**Dados adicionais a buscar:**
- Tabela `signatures` (IP, user_agent, signature_type)
- Tabela `audit_logs` (trilha de auditoria)

**Formato do anexo (Resend API):**
```typescript
await resend.emails.send({
  from: "...",
  to: [signatory.email],
  subject: "...",
  html: "...",
  attachments: [
    {
      filename: "certificado-contrato.html",
      content: Buffer.from(certificateHtml).toString("base64"),
    }
  ]
});
```

---

## Template do Certificado (Anexo)

O certificado anexado incluirá:
- Identificação do documento (título, descrição, hash)
- Lista completa de signatários com:
  - Nome e email
  - Data/hora da assinatura
  - Endereço IP
  - Navegador utilizado
  - Tipo de assinatura (desenhada/digitada)
- Trilha de auditoria completa
- Aviso de validade jurídica (Lei 14.063/2020)
- Visual premium "black & gold"

---

## Email de Conclusão Atualizado

O email terá:
- Banner de sucesso "Contrato Concluído"
- Informações do contrato
- Lista de quem assinou
- **Botão "📜 Baixar Certificado"** (link para ContractDetails)
- **Anexo HTML** do certificado

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/send-all-completion-emails/index.ts` | Gerar e anexar certificado, buscar dados completos |

---

## Fluxo de Dados

1. `SigningPage.tsx` detecta que todos assinaram
2. Chama `send-all-completion-emails`
3. Edge function:
   - Busca contrato + signatários
   - Busca assinaturas (IP, navegador)
   - Busca audit_logs
   - Gera HTML do certificado
   - Envia email para cada signatário com anexo
4. Cada signatário recebe email com certificado anexado

---

## Resultado Esperado

| Cenário | O que acontece |
|---------|----------------|
| Pedro assina (último) | Todos (João, Maria, Pedro) recebem email com certificado anexado |
| Qualquer signatário abre o email | Pode baixar o certificado direto do anexo |
| Signatário acessa a plataforma | Pode baixar o certificado pelo botão (já existe) |

**Rastreabilidade completa com certificado oficial entregue automaticamente!**

