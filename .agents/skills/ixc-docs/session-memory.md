# Memória de Sessão - IXC Docs

**Última atualização:** 2026-06-01  
**Entradas:** 6/20  
**Skill:** ixc-docs

---

## Contratos de Clientes | Score: 1 | Última: 2026-04-15

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/webservice/v1/contrato`
- **O que contém:** Endpoint POST para listar/buscar contratos com filtros
- **Exemplo:** Headers: `ixcsoft: listar`, `Authorization: Basic <token>`. Params: `qtype: "contrato.cliente_id"`, `query: "123"`, `oper: "="`, `page: "1"`, `rp: "20"`

---

## Clientes Inadimplentes | Score: 1 | Última: 2026-04-15

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/financeiro/contas-a-receber`
- **O que contém:** Endpoint GET para contas a receber com filtro de inadimplência
- **Exemplo:** `GET /api/v1/financeiro/contas-a-receber` com filtro `pagamento_data IS NULL` + `data_vencimento <= hoje`

---

## Erro 401 - Autenticação | Score: 1 | Última: 2026-04-15

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/` (seção "Erro 401 Authorization Required")
- **O que contém:** Causa e solução para erro 401 - token ausente ou inválido
- **Exemplo:** Gerar token em Configurações > Usuários > Webservice. Header: `Authorization: Token <seu-token>`

---

## Ordem de Serviço (OS) | Score: 3 | Última: 2026-06-01

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/webservice/v1/su_oss_chamado`
- **O que contém:** Endpoint POST para criar ordem de serviço
- **Exemplo:** Campos obrigatórios: `assunto`, `cliente`, `filial`, `origem_endereco`, `prioridade`, `setor`, `status`. Content-Type: `application/x-www-form-urlencoded`

---

## Status de ONU | Score: 1 | Última: 2026-04-15

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/clientes-fibra`
- **O que contém:** Endpoint GET para consultar status de ONU/Cliente Fibra
- **Exemplo:** `GET /clientes-fibra`. Campos: `status_onu` (A=autorizada, D=desautorizada), `status_potencia` (Regular/Irregular/Indefinido)

---

## Cliente Contrato (Contratos) | Score: 1 | Última: 2026-04-16

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/formulario.php?form=cliente_contrato`
- **O que contém:** Documentação do recurso de contratos com exemplos para `POST /webservice/v1/cliente_contrato`
- **Exemplo:** Postman e payload de criação/edição de contrato (campos como `id_cliente`, `status`, `status_internet`, `fidelidade`, `data_expiracao`)

---

## Contas a Receber (fn_areceber) | Score: 1 | Última: 2026-04-16

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/formulario.php?form=fn_areceber`
- **O que contém:** Documentação do recurso financeiro de contas a receber com exemplos para `POST /webservice/v1/fn_areceber`
- **Exemplo:** Operações list/get/create/update/delete via endpoint `fn_areceber`

---

## Atendimentos (su_ticket) | Score: 2 | Última: 2026-06-01

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/formulario.php?form=su_ticket`
- **O que contém:** Documentação de atendimentos/tickets com exemplos para `POST /webservice/v1/su_ticket`
- **Exemplo:** Operações CRUD e consulta por filtros no endpoint `su_ticket`

---

## Relação Atendimentos × OS × Contratos | Score: 1 | Última: 2026-06-01

- **URL:** `https://wiki-erp.ixcsoft.com.br/documentacao/guias-tutoriais/estoque-e-ordem-de-servico/acoes-no-atendimento.html`
- **O que contém:** Modelo funcional — atendimento (`su_ticket`) vincula contrato via `id_contrato`; OS (`su_oss_chamado`) vincula atendimento via `id_ticket` (somente leitura) e contrato via `id_contrato_kit`; ao finalizar OS, atendimento é solucionado automaticamente
- **Exemplo:** Filtrar atendimentos: `qtype: "su_ticket.id_contrato"`. Filtrar OS: `qtype: "su_oss_chamado.id_ticket"` ou `id_contrato_kit`

---

## Linhas MVNO (linha_mvno) | Score: 1 | Última: 2026-04-16

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/formulario.php?form=linha_mvno`
- **O que contém:** Documentação das linhas móveis MVNO com exemplos para `POST /webservice/v1/linha_mvno`
- **Exemplo:** Operações CRUD para linhas móveis vinculadas a contrato

---
