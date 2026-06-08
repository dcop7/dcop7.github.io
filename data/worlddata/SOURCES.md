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
