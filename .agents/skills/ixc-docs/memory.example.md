# Memória de Sessão - IXC Docs (Template)

**Este arquivo é um TEMPLATE de referência.** Não edite este arquivo.

Para usar a memória de sessão, crie/copie `session-memory.md` na mesma pasta e siga este formato:

---

```markdown
# Memória de Sessão - IXC Docs

**Última atualização:** YYYY-MM-DD  
**Entradas:** X/20  
**Skill:** ixc-docs

---

## [Nome do Endpoint/Módulo] | Score: [N] | Última: YYYY-MM-DD

- **URL:** `<url-completa>`
- **O que contém:** 1-2 frases descrevendo o conteúdo/endereço
- **Exemplo:** (opcional) payload, curl, ou parâmetros úteis

---

## [Próxima Entrada] | Score: [N] | Última: YYYY-MM-DD

- **URL:** `<url-completa>`
- **O que contém:** descrição
- **Exemplo:** (opcional)

---
```

---

## Regras de Preenchimento

| Campo            | Formato                  | Exemplo                                      |
| ---------------- | ------------------------ | -------------------------------------------- |
| **Nome**         | Descritivo, 2-4 palavras | `Contratos de Clientes`, `Erro 401`          |
| **Score**        | Número inteiro           | `Score: 3`                                   |
| **Última**       | ISO 8601                 | `2026-04-15`                                 |
| **URL**          | Completa com https       | `https://wikiapiprovedor.ixcsoft.com.br/...` |
| **O que contém** | 1-2 frases               | "Endpoint POST para criar contratos"         |
| **Exemplo**      | Opcional, apenas se útil | `qtype: "cliente_id", oper: "="`             |

---

## Quando Adicionar Entrada

✅ **ADICIONE quando:**

- Descobriu URL/endpont **não listado na skill**
- Funcionou após múltiplas tentativas
- Exemplo de payload/curl é útil e não está na skill

❌ **NÃO adicione quando:**

- Informação já está na skill
- URL não funcionou / erro
- É apenas uma nota passageira

---

## Sistema de Score

| Score | Significado    | Ação                |
| ----- | -------------- | ------------------- |
| 0     | Nunca foi útil | Candidato a remoção |
| 1-2   | Pouco usado    | Manter com cautela  |
| ≥3    | **Validado**   | **NÃO REMOVER**     |

**Incremente +1** toda vez que a entrada responder uma pergunta do usuário.

---

## Limites do Arquivo

- **Máximo:** 20 entradas, 150 linhas
- **Se exceder:** Remova apenas entradas com `score = 0` e mais antigas
- **Prioridade:** Mantenha entradas com `score ≥ 3`

---

## Exemplo Preenchido

```markdown
# Memória de Sessão - IXC Docs

**Última atualização:** 2026-04-15  
**Entradas:** 3/20

---

## Contratos de Clientes | Score: 3 | Última: 2026-04-15

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/webservice/v1/contrato`
- **O que contém:** Endpoint POST para listar/buscar contratos com filtros
- **Exemplo:** `qtype: "contrato.cliente_id"`, `query: "123"`, `oper: "="`

---

## Erro 401 - Token | Score: 5 | Última: 2026-04-15

- **URL:** `https://wikiapiprovedor.ixcsoft.com.br/` (seção "Erro 401")
- **O que contém:** Como gerar token em Configurações > Usuários > Webservice
- **Exemplo:** Header `Authorization: Token <token>`

---
```
