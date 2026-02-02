-- Remover política permissiva
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Criar política mais restritiva para inserção de audit logs
CREATE POLICY "Authenticated users can insert audit logs for their contracts" ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.contracts WHERE id = contract_id AND owner_id = auth.uid())
      OR user_id = auth.uid()
    )
  );