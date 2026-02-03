
# Remover Verificação OTP - Manter Fluxo Simplificado

## Fluxo Final de Assinatura

```text
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE ASSINATURA (2 ETAPAS)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. LEITURA DO DOCUMENTO                                    │
│     └─ Visualizar PDF completo                             │
│     └─ Checkbox: "Li e compreendi os termos"               │
│     └─ Botão "Prosseguir para Assinatura"                  │
│                                                             │
│  2. ASSINATURA                                              │
│     └─ Desenhar assinatura OU digitar nome                 │
│     └─ Confirmar e finalizar                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## O Que Será Mantido (Validade Jurídica)

| Evidência | Status |
|-----------|--------|
| Hash SHA-256 do documento | Mantido |
| Captura de IP real | Mantido |
| Geolocalização (headers) | Mantido |
| User Agent | Mantido |
| Log de aceite dos termos | Mantido |
| Certificado de conclusão | Mantido |

## O Que Será Removido

- Tela de verificação OTP (código de 6 dígitos)
- Envio de email com código
- Estados relacionados ao OTP no componente

## Mudanças Técnicas

### Arquivo: `src/pages/SigningPage.tsx`

1. **Remover estado `step` de 3 etapas para 2 etapas**
   - De: `'verification' | 'reading' | 'signing'`
   - Para: `'reading' | 'signing'`

2. **Remover estados relacionados ao OTP**
   - `otpValue`
   - `otpSending`
   - `otpVerifying`
   - `otpSent`
   - `otpError`

3. **Remover funções de OTP**
   - `sendOtpCode()`
   - `verifyOtp()`

4. **Remover UI de verificação OTP**
   - Tela inteira do step 'verification'
   - Componente InputOTP

5. **Iniciar direto na etapa 'reading'**
   - `useState<'reading' | 'signing'>('reading')`

## Observação

As Edge Functions `send-otp` e `verify-otp` permanecerão no projeto mas não serão chamadas. Se quiser reativar no futuro, basta restaurar o código.
