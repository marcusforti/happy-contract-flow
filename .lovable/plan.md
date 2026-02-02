

## Implementar Download de Documento

### Problema Atual
O botão "Baixar documento" na página de detalhes do contrato (`ContractDetails.tsx`) está sem funcionalidade - não tem evento `onClick` conectado.

### Solução

Adicionar uma função `downloadDocument` que:
1. Busca o arquivo do storage usando URL assinada (já que o bucket é privado)
2. Faz o download do arquivo para o usuário
3. Registra a ação na trilha de auditoria

### Alterações no Arquivo

**src/pages/ContractDetails.tsx**

1. Adicionar estado de loading para download
2. Criar função `downloadDocument`:
   - Gerar URL assinada do storage (válida por 60 segundos)
   - Fazer fetch do arquivo
   - Criar blob e disparar download
   - Registrar audit log
3. Conectar função ao botão existente

### Detalhes Técnicos

```text
Fluxo de Download:
┌─────────────────┐
│  Clica Botão    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Gera URL        │
│ Assinada (60s)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fetch + Blob    │
│ Download        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Audit Log       │
│ "downloaded"    │
└─────────────────┘
```

A função usará `supabase.storage.from('contracts').createSignedUrl()` para gerar uma URL temporária segura, já que o bucket é privado.

