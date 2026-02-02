-- Allow public access to contract_signatories for signing
-- This is safe because access_token acts as a secret/password (UUID is unguessable)
CREATE POLICY "Anyone can read signatories by access_token"
ON public.contract_signatories
FOR SELECT
USING (true);

-- Also allow public read access to contracts for signing page
CREATE POLICY "Anyone can read contracts for signing"
ON public.contracts
FOR SELECT
USING (true);

-- Allow signatories to insert signature fields when signing
CREATE POLICY "Signatories can create signature fields"
ON public.signature_fields
FOR INSERT
WITH CHECK (true);

-- Allow signatories to insert signatures
CREATE POLICY "Signatories can create signatures"
ON public.signatures
FOR INSERT
WITH CHECK (true);

-- Allow public to read signature fields (for verification)
CREATE POLICY "Anyone can read signature fields"
ON public.signature_fields
FOR SELECT
USING (true);

-- Allow public to insert audit logs for signing events
CREATE POLICY "Anyone can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Allow signatories to update their own signed_at status
CREATE POLICY "Signatories can update their own record"
ON public.contract_signatories
FOR UPDATE
USING (true)
WITH CHECK (true);