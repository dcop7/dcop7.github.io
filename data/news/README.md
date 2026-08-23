# Notícias — agregador de RSS estático

Agregador de notícias **sem backend e sem base de dados**, para GitHub Pages.

## Como funciona

1. **`feeds.opml`** — exportação do Feedly, é a **fonte de verdade** das subscrições
   RSS. Para adicionar/remover feeds, edita este ficheiro (ou substitui-o por um
   novo export). Suporta centenas de feeds.
2. **`build-news.mjs`** — corre no servidor (GitHub Action, sem CORS):
   - lê o OPML, faz fetch de todos os feeds (pool concorrente, timeout por feed,
     falhas isoladas — um feed morto não estraga a corrida);
   - parser próprio de **RSS e Atom** (sem dependências);
   - **remove duplicados** (por URL normalizado + fonte+título);
   - **classifica por tópico** (mapa fonte→tópico + palavras-chave);
   - escreve **JSON estático**.
3. **`.github/workflows/news-refresh.yml`** — corre **de 4 em 4 horas** (e manualmente),
   corre o build e faz commit dos JSON se mudarem.
4. O browser (`js/pages/noticias.js`, secção `#noticias`) lê apenas o JSON estático.

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
| Action | `news-refresh.yml` (4/4h) | `news-curate.yml` (diária) |
| Dados | `topic-*.json` | `curated/*` |
| Página | `js/pages/noticias.js` | `js/pages/noticias-destaques.js` |
| Conteúdo | ~150 artigos cronológicos | ≤12 histórias por tema |

O teto de 12 é um **limite, nunca uma quota**: temas sem material
suficiente devolvem menos, e um tema sem nada acima do mínimo editorial
(`MIN_SCORE`) desaparece do dia em vez de aparecer vazio.

### Como funciona

1. `build-curated.mjs` recolhe as **suas próprias fontes**
   (`curated-sources.mjs`), independentes do `feeds.opml` do V1.
2. A unidade é o **site**, não o feed. `curated-fetch.mjs` resolve cada
   fonte por uma cadeia, e guarda o que funcionou em
   `curated/sources-resolved.json` (TTL 7 dias):

   | # | Estratégia | Para quê |
   |---|---|---|
   | 1 | feed conhecido | o caminho normal |
   | 2 | autodiscovery no site | apanha feeds que **mudaram** |
   | 3 | news sitemap (via robots.txt) | sites sem RSS; funciona mesmo com homepage a dar 403 |
   | — | snapshot do V1 | rede de segurança, marcada como `v1 snapshot` |

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
