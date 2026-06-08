# Dados do Mundo — fontes & licenças

Todos os dados são públicos e redistribuídos com atribuição.

## Indicadores (séries por país/continente/mundo)
**Our World in Data** — https://ourworldindata.org · Licença **CC BY 4.0**.
Descarregados via `grapher/<slug>.csv` e compactados por `build-worlddata.mjs`.

| Indicador | Slug OWID |
|-----------|-----------|
| Esperança de vida | life-expectancy |
| PIB per capita | gdp-per-capita-worldbank |
| Índice de Desenvolvimento Humano | human-development-index |
| Felicidade | happiness-cantril-ladder |
| Utilizadores de Internet | share-of-individuals-using-the-internet |
| Anos de escolaridade | mean-years-of-schooling-long-run |
| Médicos (por 1000 hab.) | physicians-per-1000-people |
| Acesso a eletricidade | share-of-the-population-with-access-to-electricity |
| Emissões de CO₂ per capita | co-emissions-per-capita |
| Idade mediana | median-age |
| Filhos por mulher | children-born-per-woman |
| População urbana | share-of-population-urban |
| População | population |
| Densidade populacional | population-density |

OWID compila estes indicadores a partir de fontes como o Banco Mundial, a ONU
(World Population Prospects), o UNDP, o World Happiness Report e o Global Carbon
Project — ver a página de cada indicador para a citação primária.

## Pesquisa "em direto" (catálogo OWID)
`owid-catalog.json` é a lista de slugs de todos os gráficos do Our World in Data,
extraída do sitemap público por `build-owid-catalog.mjs`. A pesquisa filtra esta
lista localmente (instantânea) e, ao escolher um gráfico, o CSV correspondente é
obtido **em direto** de `ourworldindata.org/grapher/<slug>.csv` (CORS aberto) e
desenhado no explorador. Sem chaves nem dependências de terceiros.

## Pesquisa "em direto" (World Bank)
`wb-catalog.json` é a lista de indicadores do World Development Indicators (código
+ nome), obtida da API do World Bank por `build-wb-catalog.mjs`. A pesquisa filtra
localmente e, ao escolher um, os dados são obtidos **em direto** de
`api.worldbank.org` (CORS aberto) e desenhados no explorador. **World Bank Open
Data — CC BY 4.0.** A meta da resposta inclui `lastupdated`, mostrada como data de
atualização.

## Cidades (população)
**GeoNames** — https://www.geonames.org · Licença **CC BY 4.0**.
Ficheiro `cities15000` filtrado por `build-cities.mjs`.

## Geometria
`data/world-countries.geojson` e os GeoJSON de Portugal já existentes no repo;
factos base dos países em `data/countries.json`.

## Regenerar
```
node data/worlddata/build-worlddata.mjs     # indicadores (precisa de rede)
node data/worlddata/build-cities.mjs        # cidades (precisa de cities15000.txt)
```
