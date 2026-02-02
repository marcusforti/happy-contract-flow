
# Plano: Sistema Completo de Notificações por Email

## Visão Geral

Implementar notificações por email em três momentos críticos do fluxo de assinatura:

| Momento | Destinatário | Tipo de Email |
|---------|--------------|---------------|
| Signatário assina | O próprio signatário | Confirmação da assinatura |
| Signatário assina | Dono do contrato | Notificação de progresso |
| Todos assinam | Todos os signatários | Contrato concluído |

---

## Arquitetura das Notificações

```
┌─────────────────────────────────────────────────────────────────┐
│                    Signatário Assina                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────┴────────────────────┐
         │                                         │
         ▼                                         ▼
  ┌──────────────┐                        ┌──────────────┐
  │ Email para   │                        │ Email para   │
  │ Signatário   │                        │ Dono         │
  │ (confirmação)│                        │ (progresso)  │
  └──────────────┘                        └──────────────┘
         
                              │
                              ▼
                 ┌───────────────────────┐
                 │  Todos assinaram?     │
                 └───────────────────────┘
                         │ SIM
                         ▼
              ┌─────────────────────┐
              │ Email para TODOS    │
              │ (contrato concluído)│
              └─────────────────────┘
```

---

## Implementação Técnica

### 1. Nova Edge Function: `send-signature-confirmation`

Envia confirmação ao signatário após ele assinar:

```typescript
// Payload
{
  signatoryEmail: string;
  signatoryName: string;
  contractTitle: string;
  signedAt: string;
  remainingSignatories: number; // "Faltam X assinaturas"
}
```

**Template do email:**
- Banner: "✅ Sua assinatura foi registrada!"
- Info do contrato assinado
- Status: "Aguardando X outras assinaturas" ou "Você foi o último, contrato concluído!"
- Aviso legal sobre validade jurídica

---

### 2. Nova Edge Function: `notify-owner-signature`

Notifica o dono do contrato a cada assinatura individual:

```typescript
// Payload
{
  contractId: string;
  accessToken: string; // para validação
  origin: string;
}
```

**Lógica:**
- Busca contrato e dono (service role)
- Busca signatário que acabou de assinar
- Busca progresso total (X de Y assinaram)
- Envia email ao dono com status atualizado

**Template do email:**
- Banner: "✍️ Nova assinatura registrada"
- Quem assinou (nome + email + horário)
- Progresso visual: "2 de 3 assinaturas coletadas"
- CTA: "Ver detalhes do contrato"

---

### 3. Modificar `send-owner-completion-email`

Já existe e funciona. Apenas garantir que está sendo chamado corretamente.

---

### 4. Nova Edge Function: `send-all-completion-emails`

Envia email de conclusão para TODOS os signatários quando o contrato é finalizado:

```typescript
// Payload
{
  contractId: string;
  accessToken: string;
  origin: string;
}
```

**Lógica:**
- Busca todos os signatários do contrato
- Envia email de conclusão para cada um (reutilizando template do `send-completion-email`)
- Inclui lista de todos que assinaram + hash do documento

---

### 5. Modificar `SigningPage.tsx`

Após a assinatura bem-sucedida, disparar as edge functions:

```typescript
// Após salvar assinatura com sucesso:

// 1. Confirmar para o signatário
await supabase.functions.invoke('send-signature-confirmation', {
  body: {
    signatoryEmail: signatory.email,
    signatoryName: signatory.name,
    contractTitle: contract.title,
    signedAt: new Date().toISOString(),
    remainingSignatories: pendingCount,
  }
});

// 2. Notificar o dono
await supabase.functions.invoke('notify-owner-signature', {
  body: {
    contractId: contract.id,
    accessToken: token,
    origin: window.location.origin,
  }
});

// 3. Se todos assinaram, enviar para todos
if (allSigned) {
  await supabase.functions.invoke('send-all-completion-emails', {
    body: {
      contractId: contract.id,
      accessToken: token,
      origin: window.location.origin,
    }
  });
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/send-signature-confirmation/index.ts` | Criar | Confirmação para signatário |
| `supabase/functions/notify-owner-signature/index.ts` | Criar | Notifica dono a cada assinatura |
| `supabase/functions/send-all-completion-emails/index.ts` | Criar | Email de conclusão para todos |
| `supabase/config.toml` | Modificar | Registrar novas functions |
| `src/pages/SigningPage.tsx` | Modificar | Disparar os emails |

---

## Templates de Email (Visual Premium)

Todos seguirão o padrão visual "black & gold" já estabelecido:
- Background: #0a0a0a
- Cards: #141414 com borda dourada
- Acentos: #D4AF37 (dourado)
- Sucesso: #10b981 (verde esmeralda)
- Tipografia clara e hierarquia visual

---

## Resultado Esperado

| Cenário | Emails Disparados |
|---------|-------------------|
| João assina (1 de 3) | João recebe confirmação + Dono recebe notificação |
| Maria assina (2 de 3) | Maria recebe confirmação + Dono recebe notificação |
| Pedro assina (3 de 3) | Pedro recebe confirmação + Dono recebe notificação + TODOS recebem email de conclusão |

**Experiência completa de gestão documental com rastreabilidade total!**
