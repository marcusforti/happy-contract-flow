
# Análise de Validade Jurídica - Regozoni Docs

## Resumo Executivo

O Regozoni Docs já possui uma **base sólida** para assinaturas eletrônicas simples com validade jurídica. Porém, existem **lacunas importantes** que podem fortalecer significativamente a robustez probatória.

---

## O QUE JÁ ESTÁ IMPLEMENTADO

### 1. Hash do Documento (SHA-256)
**Status: Implementado**

| Item | Situação |
|------|----------|
| Cálculo do hash no upload | Sim, via `crypto.subtle.digest('SHA-256')` |
| Armazenamento no banco | Sim, coluna `document_hash` na tabela `contracts` |
| Exibição no certificado | Sim, no PDF e na interface |

O hash garante **integridade do documento** - qualquer alteração invalida a prova.

---

### 2. Trilha de Auditoria
**Status: Parcialmente implementado**

**O que já é registrado:**
- `created` - Contrato criado
- `viewed` - Documento visualizado
- `signed` - Assinatura realizada
- `completed` - Contrato concluído
- `downloaded` - Documento baixado
- `sent` - Enviado para assinatura

**O que é capturado por evento:**
- `contract_id`
- `signatory_id`
- `user_id`
- `action`
- `created_at` (timestamp automático)
- `user_agent` (navegador)
- `ip_address` (**sempre "N/A" - PROBLEMA**)
- `metadata` (dados extras como `signature_type`)

---

### 3. Consentimento Consciente
**Status: Implementado**

- Checkbox obrigatório "Li e compreendi os termos"
- Botão só habilita após confirmação
- Fluxo em duas etapas (Leitura → Assinatura)
- Documento visível antes da assinatura

---

### 4. Certificado de Conclusão
**Status: Implementado**

O certificado PDF contém:
- Título e descrição do contrato
- Data de criação e conclusão
- Lista de signatários com:
  - Nome e email
  - Data/hora da assinatura
  - IP (sempre "N/A" atualmente)
  - User agent (navegador)
  - Tipo de assinatura
- Hash SHA-256 do documento
- Referência à Lei 14.063/2020

---

## LACUNAS CRÍTICAS IDENTIFICADAS

### 1. IP Address - Sempre "N/A"
**Gravidade: ALTA**

O código atual **não captura o IP real** do usuário:

```typescript
// SigningPage.tsx - linha 202
await supabase.from('signatures').insert({
  ip_address: 'N/A',  // ❌ Deveria ser o IP real
  ...
});
```

**Problema**: Sem o IP, você perde uma prova importante de autoria.

**Solução**: Criar uma Edge Function para capturar o IP do request.

---

### 2. Geolocalização Ausente
**Gravidade: MÉDIA**

Não há registro de localização aproximada do signatário.

**Impacto**: Perda de evidência que pode provar onde a pessoa estava.

---

### 3. Device Fingerprint Ausente
**Gravidade: MÉDIA**

O `user_agent` é capturado, mas não há fingerprint único do dispositivo.

**Impacto**: Dificulta provar que foi o mesmo dispositivo em casos de contestação.

---

### 4. Verificação de Email Ausente
**Gravidade: MÉDIA-ALTA**

Atualmente o signatário **não precisa verificar que tem acesso ao email** - qualquer pessoa com o link pode assinar.

**Impacto**: Em uma contestação, a pessoa pode alegar "não fui eu, alguém tinha meu link".

---

### 5. Timestamp Não Certificado
**Gravidade: BAIXA**

O timestamp vem do banco de dados, que é confiável, mas não é um **carimbo de tempo certificado** (TSA).

---

### 6. Ausência de OTP/2FA
**Gravidade: MÉDIA**

Não há segundo fator de autenticação (SMS, WhatsApp, Email OTP).

---

## PLANO DE EVOLUÇÃO RECOMENDADO

### Fase 1: Correções Críticas (Prioridade Alta)

#### 1.1 Captura de IP Real
- Criar Edge Function `get-client-info`
- Retornar IP real do header `x-forwarded-for`
- Atualizar `SigningPage.tsx` para usar essa função

#### 1.2 Registro de Aceite dos Termos
- Adicionar evento `terms_accepted` no audit_log
- Registrar quando o checkbox é marcado (antes da assinatura)

---

### Fase 2: Fortalecimento Probatório (Prioridade Média)

#### 2.1 Verificação de Email via OTP
- Enviar código de 6 dígitos para o email
- Signatário precisa inserir o código para acessar
- Isso prova que a pessoa tinha acesso ao email

#### 2.2 Geolocalização Aproximada
- Solicitar permissão do navegador
- Registrar latitude/longitude (opcional, com consentimento)
- Fallback: usar IP para localização aproximada

#### 2.3 Device Fingerprint
- Usar biblioteca como FingerprintJS
- Gerar ID único do dispositivo
- Registrar no audit_log

---

### Fase 3: Assinatura Avançada (Prioridade Futura)

#### 3.1 Selfie com Documento (Biometria)
- Capturar foto do signatário com documento
- Usar IA para validar documento
- Aumenta significativamente a prova de autoria

#### 3.2 Integração ICP-Brasil (Opcional)
- Permitir assinatura com certificado digital
- Presunção legal de validade
- Ideal para contratos de alto valor

---

## RESUMO VISUAL

```text
+----------------------------------+------------------+-----------------+
| FUNCIONALIDADE                   | STATUS ATUAL     | IMPACTO JURÍDICO|
+----------------------------------+------------------+-----------------+
| Hash SHA-256                     | Implementado     | Alto            |
| Trilha de auditoria              | Parcial          | Alto            |
| Consentimento consciente         | Implementado     | Alto            |
| Certificado de conclusão         | Implementado     | Médio           |
| Captura de IP real               | NÃO IMPLEMENTADO | Alto            |
| Verificação de email (OTP)       | NÃO IMPLEMENTADO | Alto            |
| Device fingerprint               | NÃO IMPLEMENTADO | Médio           |
| Geolocalização                   | NÃO IMPLEMENTADO | Médio           |
| Biometria facial                 | NÃO IMPLEMENTADO | Alto            |
| ICP-Brasil                       | NÃO IMPLEMENTADO | Muito Alto      |
+----------------------------------+------------------+-----------------+
```

---

## RECOMENDAÇÃO

**Próximos passos imediatos:**
1. Implementar captura de IP real (1-2 horas)
2. Adicionar log de aceite dos termos (30 min)
3. Implementar verificação por OTP no email (2-3 horas)

Essas três melhorias elevam o app de **assinatura eletrônica simples** para **assinatura eletrônica avançada**, aumentando drasticamente a sustentação em juízo.

---

## SEÇÃO TÉCNICA

### Arquivos a serem modificados:

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/get-client-info/index.ts` | **Novo** - Captura IP real |
| `src/pages/SigningPage.tsx` | Chamar função de IP, registrar aceite |
| `src/integrations/supabase/types.ts` | Atualização automática após migration |

### Nova tabela sugerida (opcional):
```sql
CREATE TABLE signing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signatory_id UUID REFERENCES contract_signatories(id),
  ip_address TEXT,
  geolocation JSONB,
  device_fingerprint TEXT,
  otp_verified_at TIMESTAMPTZ,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

