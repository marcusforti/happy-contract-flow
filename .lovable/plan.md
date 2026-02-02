
# Plano: Atualização em Tempo Real do Painel

## Problema Identificado

Quando um signatário assina um contrato (e especialmente quando todos assinam), o Dashboard do proprietário não é atualizado automaticamente. O usuário precisa recarregar a página manualmente para ver as mudanças.

---

## Solução Proposta

Implementar **Supabase Realtime** para que o Dashboard receba atualizações instantâneas quando:
- Um signatário assina (status muda para `partially_signed`)
- Todos assinam (status muda para `completed`)
- Qualquer alteração nos contratos ou signatários

---

## Implementação Técnica

### 1. Habilitar Realtime na Tabela `contracts`

Criar uma migration SQL para adicionar a tabela ao canal de realtime:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
```

### 2. Adicionar Subscription no Dashboard

Modificar `src/pages/Dashboard.tsx` para:
- Criar um canal Supabase Realtime ao montar o componente
- Escutar eventos `UPDATE` na tabela `contracts`
- Atualizar o estado local quando um contrato for modificado
- Limpar a subscription ao desmontar

```typescript
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel('contracts-realtime')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'contracts',
        filter: `owner_id=eq.${user.id}`,
      },
      (payload) => {
        // Atualiza o contrato modificado no estado
        setContracts(prev => 
          prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c)
        );
        
        // Notificação visual
        if (payload.new.status === 'completed') {
          toast.success(`🎉 Contrato "${payload.new.title}" foi concluído!`);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);
```

### 3. (Opcional) Realtime nos Signatários

Para mostrar progresso em tempo real da barra de assinaturas:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_signatories;
```

E adicionar subscription para `contract_signatories` com refetch dos dados.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Habilitar realtime nas tabelas |
| `src/pages/Dashboard.tsx` | Adicionar subscription e toast de notificação |

---

## Resultado Esperado

- ✅ Dashboard atualiza instantaneamente quando um contrato muda de status
- ✅ Toast de celebração quando um contrato é concluído
- ✅ Barra de progresso de assinaturas atualiza em tempo real
- ✅ Experiência premium sem necessidade de refresh manual
