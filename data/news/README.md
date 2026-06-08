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
