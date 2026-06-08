# Fontes de dados — Secção "Eventos"

A secção **Eventos** (`#eventos`, `js/explorer/eventos.js`) agrega eventos de
várias fontes em direto, com falha graciosa (uma fonte que falhe não afeta as
restantes) e um conjunto curado offline como fallback. **Sem chaves de API** —
todas as fontes são públicas.

## Fontes em direto (fetch no browser)

| Fonte | Endpoint | Cobertura | CORS | Licença / termos |
|---|---|---|---|---|
| **AgendaLX** | `https://www.agendalx.pt/wp-json/agendalx/v1/events?per_page=100` | Agenda cultural de Lisboa (profunda) | Ecoa o `Origin` do pedido | Dados da Câmara Municipal de Lisboa / EGEAC. Uso não comercial, com atribuição. |
| **e-cultura** | `https://www.e-cultura.pt/api` | Destaques culturais nacionais | `Access-Control-Allow-Origin: *` | Agenda cultural pública (e-cultura). Atribuição. |

> Notas: o endpoint do e-cultura devolve um conjunto editorial pequeno e ignora
> parâmetros de query — a filtragem (datas, distrito, categoria, raio) é feita
> no cliente. As imagens do e-cultura são servidas sem CORS (bloqueadas por ORB
> no browser), pelo que **não são usadas** — mostramos um marcador de categoria.

## Fontes empacotadas no repositório (atualizadas por pipeline)

Algumas fontes **bloqueiam o CORS ao próprio domínio**, pelo que o browser não as
consegue buscar em direto a partir de dcop7.github.io. São obtidas no servidor
(Node não tem CORS) por uma **GitHub Action diária** (`.github/workflows/events-refresh.yml`,
cron ~05:17 UTC + execução manual), que corre os build scripts e faz commit do
snapshot atualizado — cobertura nacional fresca sem backend.

| Ficheiro | Origem | Build |
|---|---|---|
| `nocartaz.json` | **NoCartaz** (`https://www.nocartaz.pt/events.json`, agregador independente de ~9000 eventos de teatros, salas, cinemas, galerias e festivais em todos os distritos; atualizado várias vezes/dia). Snapshot trimado a eventos futuros (~150 dias), ≤2600, com distrito + relevância. | `node data/events/build-nocartaz.mjs` |
| `seed.json` | ~26 eventos/atrações **recorrentes ou permanentes** curados à mão, por distrito e categoria (festas populares, feiras semanais, monumentos, museus, festivais anuais), com horário e preço. Garante que a secção nunca fica vazia (offline ou se tudo o resto falhar). As regras (`permanent`/`weekly`/`annual`) são expandidas em runtime, por isso nunca ficam desatualizadas. | curado à mão |

## Geocodificação

| Ficheiro | Origem |
|---|---|
| `pt-places.json` | Tabela `nome-normalizado → [lat, lon]` para geocodificar eventos por **concelho/cidade**. Gerada por `build-places.mjs` a partir de `data/worlddata/cities.json` (cidades PT, GeoNames CC BY 4.0) + centróides dos 18 distritos continentais e ilhas + alguns concelhos conhecidos. Sem rede. |

Regenerar: `node data/events/build-places.mjs`

## Mapa

- Tiles: **CARTO Voyager** sobre **OpenStreetMap** (© OpenStreetMap contributors, © CARTO).
- Fronteiras de distrito: `data/pt-districts.geojson` (click_that_hood, domínio público).
- Biblioteca: **Leaflet** 1.9.4 (carregada de unpkg, BSD-2-Clause).

## Distância e "Perto de mim"

- Distância calculada com a fórmula de **haversine** (sem serviços externos).
- "Perto de mim" usa `navigator.geolocation` (com consentimento do utilizador);
  se for recusado ou indisponível, recorre à cidade/distrito selecionado
  (default **Leiria**).
