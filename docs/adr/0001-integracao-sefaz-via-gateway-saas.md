---
status: proposed
date: 2026-08-13
builds-on: []
superseded-by: null
deciders: [gugacarbo]
---

# Integração com a SEFAZ via gateway SaaS em vez de motor fiscal próprio

## Contexto e problema

A NFCom (modelo 62) exige geração de XML conforme o MOC, assinatura digital ICP-Brasil
(A1/A3), transmissão SOAP/mTLS aos webservices autorizadores (em geral o SVRS) e
tratamento de protocolo, eventos e consulta de situação. O app precisa emitir notas em
escala (faturamento mensal de telecom) e manter conformidade com um layout fiscal que é
alvo móvel — a Reforma Tributária (NT 2025.001 / 2026.001) introduz campos de IBS/CBS e
Imposto Seletivo.

Precisamos decidir se **construímos o motor fiscal** (XML + assinatura + webservices)
dentro deste repo ou se **delegamos** essa responsabilidade a um provedor externo.

O gateway `api.nfcom.com.br` encapsula toda a complexidade fiscal num backend de terceiros:
consumindo-o, o app vira um cliente HTTP/JSON — sem montar XML, assinar certificado ou
falar SOAP/mTLS.

## Direcionadores da decisão

- **Esforço**: um motor fiscal próprio exige XML, assinatura A1/A3 em Node/TS, SOAP/mTLS,
  WSDL, gestão de numeração/serie, consulta de recibo e eventos. Esforço de semanas a
  meses, com risco alto de rejeições fiscais.
- **Manutenção**: cada Nota Técnica da Receita (layout, regras de validação, Reforma
  Tributária) passa a ser responsabilidade nossa.
- **Risco**: rejeições fiscais travam o faturamento. Provedores validam isso em escala.
- **Lib TS madura para NFCom**: praticamente inexistente — o ecossistema cobre NF-e/NFC-e
  e NFS-e, mas o modelo 62 é nicho recente (obrigatório só desde 01/11/2025).
- **Diferencial de produto**: a parte fiscal pura não é o diferencial; o diferencial é o
  faturamento, a cobrança e a orquestração confiável.

## Opções consideradas

### Opção 1 — Gateway SaaS (`api.nfcom.com.br`)

A app vira cliente HTTP/JSON do provedor. Autenticação por `login`/`senha`
(`POST /api/autenticar` → bearer token, TTL ~2h), emissão por `POST /api/emitir` com
payload JSON (destinatário, itens, CFOP/cClass). O provedor cuida do XML, assinatura,
webservices e retorna `situacao` (`autorizada`/`cancelada`/`rejeitada`/`processando`),
chave, protocolo, número, PDF e XML.

**Prós:**

- Esforço de integração baixo (cliente HTTP).
- Provedor absorve mudanças de layout fiscal (NTs).
- Processo síncrono da NFCom casa bem com um request por nota.
- É o padrão de mercado para volume de telecom.

**Contras:**

- Custo recorrente por nota (R$/nota).
- Dependência de disponibilidade/latência do provedor.
- Lock-in ao contrato do provedor (campos, endpoints).

### Opção 2 — Motor fiscal próprio (integração direta com SEFAZ)

Montar XML, assinar A1/A3, falar SOAP/mTLS com os webservices do SVRS, tratar recibo e
eventos. Sem biblioteca TS madura para o modelo 62 — boa parte do motor seria construída
do zero.

**Prós:**

- Sem custo por nota; controle total.
- Sem dependência de provedor.

**Contras:**

- Esforço e risco altos; sem biblioteca TS madura.
- Toda mudança da Receita vira trabalho nosso, sob prazo regulatório.
- Rejeições fiscais recaem sobre o faturamento.

### Opção 3 — Gateway SaaS de outro provedor (Focus NFe, TecnoSpeed, Nuvem Fiscal)

Mesma arquitetura da Opção 1, trocando o provedor.

**Prós:**

- Provedores maduros, com boa documentação.

**Contras:**

- Contrato próprio (campos, endpoints) diferente do avaliado na Opção 1 — exige nova
  avaliação de aderência e integração.
- Avaliação caso a caso de cobertura/preço.

## Decisão

**Integrar com a SEFAZ via gateway SaaS `api.nfcom.com.br` (Opção 1).** A complexidade
fiscal fica encapsulada num módulo `nfcom` (anti-corruption layer, ADR-0004) que isola o
contrato do provedor do resto do domínio. O app não conhece XML, assinatura nem
webservices — apenas o contrato JSON do gateway.

## Consequências

**Positivas:**

- Foco de engenharia no domínio de faturamento/cobrança/orquestração (o diferencial).
- Mudanças de layout fiscal são absorvidas pelo provedor.
- Time-to-market curto.

**Negativas:**

- Custo por nota e dependência operacional do provedor.
- Acoplamento ao contrato `api.nfcom.com.br` — mitigado pela ACL (ADR-0004), que torna a
  troca de provedor uma alteração localizada.

**Obrigatório a partir de agora:**

- Toda comunicação com a SEFAZ passa pelo módulo `nfcom`; nada de lógica fiscal espalhada.
- O módulo `nfcom` publica um **contrato interno de domínio** (próprio do app), não uma
  passagem direta dos tipos do provedor.

## Confirmação

```bash
# O módulo nfcom é a única fronteira com a SEFAZ — nenhum outro módulo referencia
# endpoints do provedor diretamente.
grep -rn "api/emitir\|api/autenticar\|nfcom.com.br" src/ | grep -v "src/modules/nfcom" && exit 1
# exit 1 se encontrar menção ao provedor fora do módulo nfcom.
```

## Notas

- Avaliação de provedor alternativo (Opção 3) pode virar ADR futuro se custo/disponibilidade
  do `nfcom.com.br` se tornarem problema. A ACL (ADR-0004) isola essa troca.
- Cancelamento/substituição de NFCom (até 120h após o último dia do mês de autorização)
  depende de o provedor expor o endpoint — a confirmar em **SPEC-0003** (reservada no
  BACKLOG), fora do primeiro ciclo (somente emissão, SPEC-0001).
