# Notícias — agregador de RSS estático

Agregador de notícias **sem backend e sem base de dados**, para GitHub Pages.

## Arquitetura

Uma lista de fontes, uma camada de aquisição, duas vistas.

```
sources.mjs        1 registo por fonte, com topic (Todas) e theme (Destaques)
     │
     ▼
acquire.mjs        o ÚNICO sítio que faz fetch e parse de um feed
     │             cadeia: scrape → feed conhecido → autodiscovery
     │                     → news sitemap → pesquisa
     │
     ├──▶ build-news.mjs      → topic-*.json   Notícias ▸ Todas   (4/4h)
     └──▶ build-curated.mjs   → curated/*      Notícias ▸ Destaques (diário)
```

Antes havia duas implementações do mesmo trabalho — uma sobre o
`feeds.opml`, outra sobre um `curated-sources.mjs` — com dois parsers e
dois normalizadores de URL. O mesmo bug do Blogger (atributos Atom com
plicas, que devolviam zero itens em todos os feeds Blogger) teve de ser
encontrado e corrigido **duas vezes**. Agora corrige-se uma.

O `feeds.opml` continua no repositório como o export original do Feedly,
mas **já não é lido por nada**.

1. **`sources.mjs`** — a lista. Cada registo tem `topic` (em que separador
   aparece em Todas) e `theme` (que tema de Destaques alimenta, ou `null`
   quando a fonte não é curada de propósito: formatos como TLDR/fact-check,
   ou fontes retiradas da curadoria por qualidade).
2. **`acquire.mjs`** — resolve cada fonte pela cadeia, com pool concorrente,
   timeout por fonte e falhas isoladas (uma fonte morta não estraga a
   corrida). Parser próprio de RSS e Atom, sem dependências.
3. **`build-news.mjs`** — só o que é específico de Todas: 17 tópicos,
   classificação por palavra-chave, trailers TMDB, janela de 30 dias,
   dedupe e os shards por tópico.
4. **`.github/workflows/refresh-often.yml`** — passo "Notícias", quando o `index.json` tem mais de 3,5 h (e manualmente).
5. O browser (`js/pages/noticias.js`) lê apenas o JSON estático.

## Output (gerado — não editar à mão)

| Ficheiro | Conteúdo |
|---|---|
| `index.json` | catálogo: tópicos + contagens, fontes + estado, totais, timestamp |
| `latest.json` | ~180 artigos mais recentes de todos os tópicos (aba "Principal") |
| `topic-<id>.json` | ~140 artigos mais recentes por tópico |

Tópicos (por prioridade): **portugal, tecnologia, devops, mundo, economia,
automovel, gaming, cinema**. Retenção: 14 dias.

## Regenerar localmente

```
node data/news/build-news.mjs
```

Sem chaves de API. Todas as fontes são feeds RSS/Atom públicos do OPML.

---

## Destaques — a curadoria diária

Camada **separada e opcional** por cima do agregador acima. Não toca em
nada do que está descrito nesta página: mesmos feeds, mesmos
`topic-*.json`, mesma Action. Só acrescenta uma segunda passagem.

As duas são vistas da mesma secção Notícias, mas os pipelines são
independentes de ponta a ponta — a curadoria pode falhar um dia inteiro
sem que a vista Todas dê por isso.

| | Todas | Destaques |
|---|---|---|
| Rota | `#noticias/todas` | `#noticias/destaques` (predefinição) |
| Script | `build-news.mjs` | `build-curated.mjs` |
| Action | `refresh-often.yml` ▸ Notícias (~4/4h) | `refresh-destaques.yml` (diária) |
| Dados | `topic-*.json` | `curated/*` |
| Página | `js/pages/noticias.js` | `js/pages/noticias-destaques.js` |
| Fontes | registos com `topic` | registos com `theme` |
| Conteúdo | ~150 artigos cronológicos | ≤15 histórias por tema |

O teto de 15 é um **limite, nunca uma quota**: temas sem material
suficiente devolvem menos, e um tema sem nada acima do mínimo editorial
(`MIN_SCORE`) desaparece do dia em vez de aparecer vazio.

### Como funciona

1. `build-curated.mjs` usa os registos de `sources.mjs` que têm `theme`.
2. A unidade é o **site**, não o feed. `acquire.mjs` resolve cada fonte
   por uma cadeia e guarda o que funcionou em
   `sources-resolved.json` (TTL 7 dias, chaveado pelo **nome** da fonte —
   sete secções do MakeUseOf e cinco newsletters TLDR partilham o mesmo
   site e colidiam quando a chave era o site):

   | # | Estratégia | Para quê |
   |---|---|---|
   | 0 | scrape | só para fontes com `kind:'scrape'` — as 4 que nunca tiveram feed |
   | 1 | feed conhecido | o caminho normal |
   | 2 | autodiscovery no site | apanha feeds que **mudaram** |
   | 3 | news sitemap (via robots.txt) | sites sem RSS; funciona mesmo com homepage a dar 403 |
   | 4 | pesquisa (TinyFish) | **último recurso**, só para sites que recusam fetch automático |
   | — | snapshot do V1 | rede de segurança, marcada como `v1 snapshot` |

   A estratégia 4 precisa de `TINYFISH_KEY` (secret da Action). Sem chave,
   sem rede ou com resposta inválida, a fonte fica `none` — exatamente o
   comportamento que existia antes da estratégia. Nunca corre quando
   qualquer estratégia anterior devolveu artigos: a pesquisa ordena por
   relevância e o RSS enumera por recência, por isso é um chão por baixo
   das fontes bloqueadas, nunca um substituto do feed.

   Acrescentar uma fonte = uma linha `{ name, site }`. O `feed` é
   opcional. Um site que tire o RSS cai sozinho para o nível seguinte.
3. Consolida em **13 temas editoriais** (`curated-themes.mjs`).
   `carros`+`f1` → `automovel`; `tldr`, `trailers` e `factcheck` ficam de
   fora — são formatos, não temas.
4. Pré-filtra: janela de 24 h (alarga para 36 h num tema demasiado
   parado), dedupe por URL, máximo 60 candidatos por tema.
4. Divide em blocos dentro do orçamento de tokens da Groq e pede ao
   modelo que agrupe, ordene, resuma e justifique.
5. **O modelo devolve só `id`s de artigos.** URLs, fontes, datas e
   imagens são reanexados por lookup. Um `id` que não exista invalida a
   história — inventar uma fonte é estruturalmente impossível.
7. Valida contra o esquema e só então escreve.

### Output (gerado — não editar à mão)

| Ficheiro | Conteúdo |
|---|---|
| `curated/latest.json` | a edição que a página lê |
| `curated/d/AAAA-MM-DD.json` | detalhe diário (retenção: 30 dias) |
| `curated/index.json` | catálogo + arquivo (`days`, e `weeks`/`months` reservados) |
| `curated/sources-resolved.json` | cache do resolvedor: que estratégia serve cada site |

Retenção futura (semanal 30 d–6 m, mensal 6–18 m) é **determinística**:
o `rank` e o `score` diários já estão gravados, por isso a compactação é
uma função pura dos ficheiros em disco e não custa chamadas de IA.

### Correr localmente

```
node data/news/build-curated.mjs --dry-run   # plano de lotes, sem API
node data/news/build-curated.mjs --mock      # cadeia completa, sem API
node data/news/build-curated.mjs --check     # validar o que está commitado
GROQ_KEY=... node data/news/build-curated.mjs
```

Sem `GROQ_KEY` o script sai em silêncio sem escrever nada — a edição
anterior mantém-se publicada.
