-- Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'signatory');

-- Enum para status do contrato
CREATE TYPE public.contract_status AS ENUM ('draft', 'pending', 'partially_signed', 'completed', 'expired');

-- Enum para tipo de assinatura
CREATE TYPE public.signature_type AS ENUM ('draw', 'type');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de roles (separada conforme boas práticas)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'signatory',
  UNIQUE (user_id, role)
);

-- Tabela de contratos
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT, -- caminho no storage
  document_hash TEXT, -- SHA-256 para integridade
  status contract_status NOT NULL DEFAULT 'draft',
  signing_order TEXT NOT NULL DEFAULT 'parallel', -- 'sequential' ou 'parallel'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de signatários do contrato
CREATE TABLE public.contract_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  signing_order INT NOT NULL DEFAULT 1, -- ordem de assinatura
  access_token UUID NOT NULL DEFAULT gen_random_uuid(), -- link único
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campos de assinatura posicionados no documento
CREATE TABLE public.signature_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  signatory_id UUID REFERENCES public.contract_signatories(id) ON DELETE CASCADE NOT NULL,
  page_number INT NOT NULL DEFAULT 1,
  x_position DECIMAL NOT NULL,
  y_position DECIMAL NOT NULL,
  width DECIMAL NOT NULL DEFAULT 200,
  height DECIMAL NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assinaturas realizadas
CREATE TABLE public.signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signatory_id UUID REFERENCES public.contract_signatories(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES public.signature_fields(id) ON DELETE CASCADE NOT NULL,
  signature_type signature_type NOT NULL,
  signature_data TEXT NOT NULL, -- base64 da imagem ou texto
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trilha de auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  signatory_id UUID REFERENCES public.contract_signatories(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'created', 'viewed', 'signed', 'completed', 'downloaded'
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Função para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Políticas RLS para contracts
CREATE POLICY "Owners can manage their contracts" ON public.contracts
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Admins can view all contracts" ON public.contracts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para signatories
CREATE POLICY "Contract owners can manage signatories" ON public.contract_signatories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.contracts WHERE id = contract_id AND owner_id = auth.uid())
  );

-- Políticas RLS para signature_fields
CREATE POLICY "Contract owners can manage signature fields" ON public.signature_fields
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.contracts WHERE id = contract_id AND owner_id = auth.uid())
  );

-- Políticas RLS para signatures
CREATE POLICY "Contract owners can view signatures" ON public.signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contract_signatories cs
      JOIN public.contracts c ON cs.contract_id = c.id
      WHERE cs.id = signatory_id AND c.owner_id = auth.uid()
    )
  );

-- Políticas RLS para audit_logs
CREATE POLICY "Contract owners can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contracts WHERE id = contract_id AND owner_id = auth.uid())
  );

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Storage bucket para PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);

-- Políticas de storage
CREATE POLICY "Users can upload contracts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own contracts" ON storage.objects
  FOR SELECT USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own contracts" ON storage.objects
  FOR DELETE USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);