

## Implementar Download de Certificado de Conclusao

### Visao Geral

O botao "Baixar certificado" ja existe na interface quando o contrato esta com status "completed", mas nao tem funcionalidade. Vamos implementar a geracao e download de um certificado de conclusao em formato HTML/PDF.

### O Que e o Certificado

Documento que comprova a validade juridica da assinatura eletronica, contendo:

- **Identificacao do Contrato**: Titulo, descricao, data de criacao
- **Hash do Documento**: SHA-256 para verificacao de integridade
- **Lista de Signatarios**: Nome, email, data/hora da assinatura, IP e navegador
- **Trilha de Auditoria**: Principais eventos (criacao, envio, assinaturas)
- **Declaracao Legal**: Referencia a Lei 14.063/2020 (assinatura eletronica simples)

### Alteracoes no Arquivo

**src/pages/ContractDetails.tsx**

1. Adicionar estado `downloadingCertificate`

2. Criar funcao `downloadCertificate`:
   - Buscar assinaturas com detalhes (IP, user_agent, timestamp)
   - Gerar HTML estilizado com branding Regozoni Docs
   - Converter para blob e disparar download
   - Registrar audit log

3. Conectar funcao ao botao existente (linha 480-485)

### Detalhes Tecnicos

```text
Estrutura do Certificado:
+------------------------------------------+
|       CERTIFICADO DE CONCLUSAO           |
|         Regozoni Docs                     |
+------------------------------------------+
| Contrato: [Titulo]                        |
| Criado em: [Data]                         |
| Concluido em: [Data]                      |
| Hash SHA-256: [Hash do documento]         |
+------------------------------------------+
|           SIGNATARIOS                     |
+------------------------------------------+
| Nome: Fulano                              |
| Email: fulano@email.com                   |
| Assinado em: 02/02/2026 14:30:00          |
| IP: 192.168.1.1                           |
| Navegador: Chrome/Windows                 |
+------------------------------------------+
| Nome: Ciclano                             |
| ...                                       |
+------------------------------------------+
|       TRILHA DE AUDITORIA                 |
+------------------------------------------+
| 02/02/2026 10:00 - Contrato criado        |
| 02/02/2026 10:05 - Enviado para assinatura|
| 02/02/2026 14:30 - Fulano assinou         |
| 02/02/2026 15:45 - Ciclano assinou        |
| 02/02/2026 15:45 - Contrato concluido     |
+------------------------------------------+
|       VALIDADE JURIDICA                   |
| Lei 14.063/2020 - Assinatura Eletronica   |
+------------------------------------------+
```

### Dados Necessarios

Buscar da tabela `signatures`:
- IP do signatario
- User agent (navegador)
- Data/hora da assinatura
- Tipo de assinatura (drawn/typed)

Ja disponivel no estado atual:
- Contrato (titulo, hash, datas)
- Signatarios (nome, email, signed_at)
- Audit logs (eventos)

### Formato do Download

O certificado sera gerado como HTML com CSS inline e baixado como arquivo `.html`. O usuario pode abrir no navegador e imprimir/salvar como PDF se desejar.

### Fluxo da Funcao

1. Verificar se contrato esta concluido
2. Buscar assinaturas detalhadas do banco
3. Montar HTML com dados do contrato, signatarios e auditoria
4. Criar blob e disparar download
5. Registrar no audit_logs: "certificate_downloaded"
6. Mostrar toast de sucesso

