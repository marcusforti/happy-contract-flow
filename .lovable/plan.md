

## Sistema de Assinatura de Contratos

### Visão Geral
Plataforma completa para criação, envio e assinatura de contratos digitais, com validade jurídica através de trilha de auditoria.

---

### 1. Autenticação e Usuários
- **Login/Cadastro** para usuários internos (administradores) e externos (signatários)
- **Perfis de acesso**: Admin (cria e envia contratos) e Signatário (apenas assina)
- **Dashboard personalizado** por tipo de usuário

---

### 2. Gestão de Contratos
- **Upload de PDFs** existentes para assinatura
- **Editor de contratos** com templates pré-definidos
- **Biblioteca de templates** reutilizáveis
- **Status do contrato**: Rascunho, Aguardando assinaturas, Parcialmente assinado, Concluído, Expirado

---

### 3. Fluxo de Assinatura
- **Definição de múltiplos signatários** com ordem de assinatura (sequencial ou paralela)
- **Posicionamento de campos** de assinatura no documento
- **Duas formas de assinar**: Desenhar com o dedo/mouse ou Digitar o nome (fonte cursiva)
- **Link único** para cada signatário acessar e assinar

---

### 4. Trilha de Auditoria (Validade Jurídica)
- **Registro automático** de IP, data/hora e navegador de cada ação
- **Hash SHA-256** do documento para garantir integridade
- **Histórico completo** de visualizações e assinaturas
- **Certificado de conclusão** gerado automaticamente com todos os dados de auditoria

---

### 5. Visualização e Download
- **Visualizador de PDF** integrado
- **Download do documento assinado** com todas as assinaturas aplicadas
- **Download do certificado de auditoria** como comprovante legal

---

### 6. Dashboard e Relatórios
- **Visão geral** de contratos por status
- **Filtros e busca** por data, signatário, status
- **Alertas visuais** para contratos pendentes ou próximos do vencimento

---

### Preparado para o Futuro
- Estrutura pronta para **notificações por email** (Resend)
- Arquitetura extensível para **integração Gov.br**

---

### Tecnologias
- **Supabase**: Banco de dados, autenticação e storage para PDFs
- **PDF.js**: Visualização de documentos
- **Canvas/Signature Pad**: Captura de assinatura desenhada

