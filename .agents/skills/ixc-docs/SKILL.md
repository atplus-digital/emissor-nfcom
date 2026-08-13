---
name: ixc-docs
description: >
  Use this skill whenever the user asks anything related to IXC, IXCSoft, IXC Provedor, or ERP-IXC —
  especially for API endpoints, integration examples, authentication, or how to query data via API.
  This includes questions like "como buscar X na API do IXC", "endpoint para listar clientes",
  "como filtrar contratos por status na API", "erro 401 na API IXC", "qual URL da API",
  or any API integration task. Always use this skill before answering IXC API questions from memory —
  the official Wiki API Provedor and Postman collections are the authoritative sources.
  Also use for functional/operational questions about the IXC ERP system.
---

# Quick Start

**Antes de responder qualquer pergunta sobre IXC:**

1. **Leia `session-memory.md`** PRIMEIRO (busque por palavras-chave)
2. **Encontrou entrada relevante?** Use a URL + **incremente score em +1**
3. **Não encontrou?** Faça WebFetch na Wiki API Provedor
4. **Descobriu algo novo?** Salve em `session-memory.md` (score inicial = 1)
5. **Cite fontes** na resposta (memória + Wiki API)

---

# Documentação IXC ERP

Sempre consulte as fontes abaixo na ordem indicada. Use `WebFetch` para buscar conteúdo relevante.

## Prioridade: API > Funcional

| Tipo de Pergunta            | Fonte Primária              |
| --------------------------- | --------------------------- |
| **API / Integração**        | Wiki API Provedor (seção 2) |
| **Funcional / Operacional** | Wiki ERP (seção 1)          |

---

## Fontes de Documentação

### 1. Wiki ERP (Uso do Sistema)

**URL base:** `https://wiki-erp.ixcsoft.com.br/documentacao`

**Use para:** Tutoriais, regras de negócio, menus, relatórios, configurações operacionais, dúvidas de usuários do sistema (não desenvolvedores).

**Como navegar:** WebFetch na URL base → descubra seções → acesse seção específica.

**Dica:** A estrutura segue menus do IXC: **Menu Sistema, Relatórios, Configurações, Ferramentas**.

---

### 2. Wiki API Provedor (PRIORIDADE PARA INTEGRAÇÃO)

**URL base:** `https://wikiapiprovedor.ixcsoft.com.br/`

**USE SEMPRE QUE ENVOLVER:**

- Buscar/listar dados via API (clientes, contratos, financeiro, etc.)
- Endpoints REST, métodos HTTP, parâmetros de filtro
- Autenticação por token, erro 401
- Exemplos de requisição/resposta JSON
- Integração de sistemas externos

**Módulos Principais:**

| Módulo         | URL Pattern                                     | Exemplos                          |
| -------------- | ----------------------------------------------- | --------------------------------- |
| **Cadastros**  | `/clientes`, `/contratos`, `/produtos`          | `GET /clientes`, `POST /clientes` |
| **Financeiro** | `/cobrancas`, `/contas`, `/condicoes-pagamento` | Contas a receber, criar cobrança  |
| **Provedor**   | `/onus`, `/olts`, `/planos-velocidade`          | ONUs, OLTs, status de conexão     |
| **CRM**        | `/leads`, `/negociacoes`, `/propostas`          | Leads, funil de vendas            |
| **Suporte**    | `/ordens-servico`, `/tickets`                   | Criar OS, consultar status        |
| **Estoque**    | `/almoxarifados`, `/transferencias`             | Controle de materiais             |
| **VoIP**       | `/ramais`, `/chamadas`, `/tarifas`              | Ramais SIP, chamadas              |

**Erros Comuns:**

- **401:** Token ausente/inválido → seção "Erro 401 Authorization Required"
- **404:** Endpoint não encontrado → seção "Erro 404 Not Found"
- **400:** Requisição inválida → seção "Erro 400 Bad Request"

**Token de Acesso:**

- Obter em: Configurações > Usuários > Webservice > Gerar Token
- Header: `Authorization: Token <seu-token>`

---

### 3. Postman / API IXC (Exemplos Práticos)

**URL:** `https://www.postman.com/api-ixc/api-ixc`

**Use para:** Exemplos concretos de requisições, coleções prontas, payloads completos.

---

## Memória de Sessão (Cache de Descobertas)

**ARQUIVO:** `/home/gustavo_carbonera/Desktop/crm-atplus/.agents/skills/ixc-docs/session-memory.md`

**TEMPLATE DE REFERÊNCIA:** `memory.example.md` (não edite, use como guia de formato)

### Fluxo Obrigatório

```
1. Ler session-memory.md ANTES de WebFetch
2. Buscar por palavras-chave da pergunta (ex: "contratos", "inadimplente", "ONU")
3. Se encontrou → Usar URL da memória + Incrementar score (+1)
4. Se NÃO encontrou → WebFetch na Wiki API
5. Se descobriu algo novo → Salvar entrada (score inicial = 1)
6. Citar fontes na resposta (memória como fonte secundária)
```

### Quando Salvar Nova Entrada

| Ação              | Critério                                       |
| ----------------- | ---------------------------------------------- |
| ✅ **SALVAR**     | URL/endpont **não listado na skill**           |
| ✅ **SALVAR**     | Funcionou após múltiplas tentativas            |
| ✅ **SALVAR**     | Exemplo de payload/curl útil e não documentado |
| ❌ **NÃO SALVAR** | Informação já coberta pela skill               |
| ❌ **NÃO SALVAR** | URL não funcionou / erro                       |

### Formato da Entrada

```markdown
## [Nome Descritivo] | Score: [N] | Última: YYYY-MM-DD

- **URL:** `<url-completa-com-https>`
- **O que contém:** 1-2 frases descrevendo conteúdo
- **Exemplo:** (opcional) payload, curl, parâmetros
```

### Sistema de Score

**Incremente +1 quando:**

- A entrada respondeu a pergunta do usuário
- A URL funcionou corretamente
- O exemplo foi útil

**NÃO REMOVA entradas com Score ≥ 3** — Validadas como úteis.

**Limites:**

- Máximo **20 entradas**
- Máximo **150 linhas**
- Se exceder: remova apenas `score = 0` + mais antigas

---

## Estratégia de Consulta

### Para Perguntas de API

1. **Leia `session-memory.md`** → busque por palavras-chave
2. **Se encontrou:** Use URL + incremente score → pule para passo 5
3. **Se NÃO encontrou:** Identifique módulo (Cadastros, Financeiro, Provedor, etc.)
4. **WebFetch** em `wikiapiprovedor.ixcsoft.com.br/<modulo>/<endpoint>`
5. **Consulte Postman** se precisar de exemplos de payload
6. **Verifique erros comuns** se mencionar 401/404/400

### Para Perguntas Funcionais

1. **WebFetch** em `wiki-erp.ixcsoft.com.br/documentacao`
2. **Navegue por menus:** Menu Sistema, Relatórios, Configurações
3. **Consulte Dúvidas Frequentes** se for pergunta comum

### Fontes Alternativas

- **Assistentes Inteligentes IXC:** `wiki-erp.ixcsoft.com.br/documentacao/artigos/assistentes-inteligentes`
  - IA de suporte para dúvidas rápidas
  - Use como complemento se docs principais não forem suficientes

---

## Regras Gerais

1. **Cite sempre a fonte** com URL acessada
2. **Tente múltiplas fontes** antes de dizer "não sei"
3. **Para API, sempre inclua:** método HTTP, endpoint, parâmetros, exemplo de requisição
4. **Use memória primeiro** — economiza tempo e tokens

---

## Autenticação da API

```http
Authorization: Token <seu-token-aqui>
```

**Erro `401 Authorization Required`:** Token ausente ou inválido.

**Como obter:**

1. Acesse IXC → Configurações → Usuários → selecione usuário
2. Abra aba "Webservice" ou "API"
3. Clique em "Gerar Token"
4. Copie token e inclua no header de TODAS as requisições

---

## Idioma

O IXC é um sistema brasileiro — toda documentação e respostas devem ser em **português**.
