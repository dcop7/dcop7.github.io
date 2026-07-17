# Cidadão — fontes e arquitetura de dados

Missão: agregar prazos, apoios e mudanças do Estado português numa camada
simples e de manutenção quase nula. **Não substitui os serviços oficiais** —
todos os cartões apontam para o link oficial.

## Ficheiros

| Ficheiro | Origem | Conteúdo |
|---|---|---|
| `calendario.json` | curado (manual) | Regras de prazos anuais (`range`/`day`/`multi`/`monthly`) e pessoais (`personal`: IUC, inspeção, CC, carta). O browser expande as regras em datas concretas com o AppTime — não há datas hard-coded por ano. `approx: true` = janela típica fixada anualmente por despacho. |
| `apoios.json` | curado (manual) | Catálogo de apoios/benefícios com tags de perfil, valores indicativos e link oficial. `littleKnown` marca apoios subutilizados (alimenta o bloco "Podes estar a perder"). |
| `novidades.json` | **automático** (Action 6/6h) | Novidades oficiais agregadas + radar de candidaturas. |
| `linkcheck.json` | **automático** (Action 6/6h) | Estado dos links curados — se um organismo mudar o URL, aparece aqui sem ninguém ter de testar à mão. `ok: null` = erro de rede (anti-bot), não é link morto. |

## Fontes automáticas (build-cidadao.mjs)

Verificadas a 2026-07-17; todas públicas, sem chaves:

- **Diário da República — Série I (RSS oficial)**
  `https://files.diariodarepublica.pt/rss/serie1.xml` — legislação do dia.
  (O site principal diariodarepublica.pt é OutSystems e não serve RSS; este
  endpoint em `files.` é o feed oficial "Diário do Dia".)
- **Google News RSS restringido a domínios oficiais** — funciona como RSS
  sintético para portais do Estado sem feed utilizável (testado: os sites de
  portugal.gov.pt, seg-social.pt e eportugal.gov.pt devolvem HTML/aplicações,
  não RSS): `news.google.com/rss/search?q=site:<domínio>&hl=pt-PT&gl=PT&ceid=PT:pt-150`.
  Usado para: Governo, ePortugal, Segurança Social, Finanças, IEFP, DGES,
  Portal da Habitação.
- **Radar de candidaturas** — pesquisa Google News por anúncios de
  candidaturas/apoios abertos, com filtro de ruído; os resultados aparecem
  na tab Agora ("Radar de candidaturas") e marcados com 🎯.

Notas de robustez:
- Uma fonte que falhe não derruba as outras (pool com timeout por fonte).
- Se **todas** falharem, o `novidades.json` anterior é mantido.
- `seg-social.pt` recusa o fetch do Node (anti-bot) mas abre no browser e no
  curl — por isso o link-check trata erro de rede como "desconhecido".
- Crons do GitHub atrasam horas: nada depende da hora exata de execução.

## Possíveis extensões

- `dados.gov.pt` API (`/api/1/datasets/?q=…`) — datasets abertos AMA (JSON, sem chave).
- RSS Série II do DRE (`…/rss/serie2.xml`) — muito ruidoso, ficou de fora.
- Feeds municipais (câmaras com RSS) para uma vertente local.
