-- Function to mark contract as completed when all signatories have signed
-- This runs with elevated privileges to bypass RLS
CREATE OR REPLACE FUNCTION public.complete_contract_if_all_signed(p_contract_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_signatories INT;
  v_signed_count INT;
  v_current_status TEXT;
BEGIN
  -- Get contract status
  SELECT status INTO v_current_status
  FROM contracts
  WHERE id = p_contract_id;
  
  -- If already completed, return true
  IF v_current_status = 'completed' THEN
    RETURN TRUE;
  END IF;
  
  -- Count signatories
  SELECT COUNT(*), COUNT(CASE WHEN signed_at IS NOT NULL THEN 1 END)
  INTO v_total_signatories, v_signed_count
  FROM contract_signatories
  WHERE contract_id = p_contract_id;
  
  -- If all signed, update to completed
  IF v_total_signatories > 0 AND v_signed_count = v_total_signatories THEN
    UPDATE contracts
    SET status = 'completed', updated_at = now()
    WHERE id = p_contract_id;
    
    RETURN TRUE;
  END IF;
  
  -- If some signed but not all, update to partially_signed
  IF v_signed_count > 0 AND v_signed_count < v_total_signatories THEN
    UPDATE contracts
    SET status = 'partially_signed', updated_at = now()
    WHERE id = p_contract_id
    AND status != 'partially_signed';
  END IF;
  
  RETURN FALSE;
END;
$$;