

# Ajustes no Email de Convite

## Resumo
Atualizar o texto fallback e o botão de ação do email de convite para assinatura, deixando mais profissional e alinhado com o padrão da IA.

---

## Mudanças

### 1. Texto Fallback (linhas 43-47)

**Atual:**
```
"{senderName} enviou um documento para você assinar através da plataforma Regozoni Docs."
```

**Novo:**
```
"A Regozoni Docs, plataforma oficial de assessoria jurídica do Dr. Sidney Regozoni, atua neste ato em nome de {senderName} para formalizar o documento "{contractTitle}".

Solicitamos a gentileza de revisar o documento e proceder com a assinatura eletrônica através do botão abaixo."
```

---

### 2. Botão CTA (linha 120)

**Atual:** `Assinar Documento`

**Novo:** `Revisar e Assinar`

---

## Arquivo Modificado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/send-signing-email/index.ts` | Texto fallback + texto do botão |

---

## Após Implementação

Será necessário testar enviando um email real para verificar a formatação.

