# Oceano Profundo: fontes, licenças e aproximações

Os ficheiros desta pasta são gerados por `tools/ocean/fetch.mjs`, que descarrega as fontes para `tools/ocean/_src/` (não versionado), e por `tools/ocean/build.mjs`, que escreve `data/ocean/`.

## Dados

| Ficheiro | Fonte | Licença |
|---|---|---|
| `*-local.bin` | **GMRT**, Global Multi-Resolution Topography (Ryan et al. 2009, Lamont-Doherty Earth Observatory), GridServer, camada `topo`. Grelha de 257 colunas com passo de cerca de 23 a 34 m. | CC BY 4.0. A atribuição é mostrada no painel "Fontes". |
| `*-region.bin` | GMRT. Grelha de 384 colunas com passo de cerca de 300 a 800 m. | CC BY 4.0 |
| `sites.json` › `prof` | **World Ocean Atlas 2023** (NOAA NCEI): temperatura, salinidade e oxigénio, média anual (1°), lidos no THREDDS NCSS. | Domínio público (US Gov) |
| `sites.json` › `obis` | **OBIS** API v3: apenas *contagens agregadas* de registos por zona de profundidade e o número de espécies. Nenhum registo individual é guardado. | Os conjuntos de dados têm licenças próprias; aqui só se publicam estatísticas derivadas, com citação do OBIS. |
| `taxa.json` | **WoRMS** REST: classificação e AphiaID. **OBIS**: histograma de profundidade das ocorrências por táxon. | WoRMS: CC BY 4.0. OBIS: como acima. |

Os grids `.bin` são Int16 little-endian com a profundidade em metros (negativa abaixo do nível do mar). As dimensões e as caixas geográficas estão em `sites.json`.

## Modelos, texturas e som

- **Todos os animais e o submersível são reconstruções procedimentais originais** (`js/explorer/ocean/o-fauna.mjs`), feitas a partir de descrições morfológicas da literatura citada no painel de cada espécie. Não usam nenhum modelo, textura ou fotografia de terceiros. A app mostra-os como "reconstrução ilustrativa".
- O fundo do mar é a batimetria real com detalhe procedimental acrescentado (rugosidade, nódulos, rochas, chaminés), marcado como ilustrativo.
- O som é sintetizado com Web Audio (`o-sound.mjs`), sem amostras.

## Física calculada no browser

- **Pressão**: Saunders (1981), com a latitude do local.
- **Temperatura abaixo do fundo do WOA23** (5 500 m): temperatura potencial constante, mais aquecimento adiabático segundo UNESCO 1983 (Fofonoff & Millard, ATG). Na Fossa das Marianas dá cerca de 2,5 °C no fundo, coerente com Taira et al. (2005).
- **Luz solar**: Ed(z) = Ed(0)·e^(−Kd·z), com Kd(RGB) = (0,38; 0,068; 0,022) m⁻¹ para água oceânica muito limpa (ordem de grandeza de Morel et al. 2007). À noite usa-se a lua cheia, cerca de 2,5 × 10⁻⁶ da luz do Sol.

## Aproximações conhecidas

- **Densidades e comportamento dos animais são ilustrativos.** Os intervalos de profundidade e os locais respeitam a literatura; quantos aparecem e como nadam, não. O cachalote aparece uma vez por mergulho, para dar escala.
- A cor e a extinção da água são um modelo de três canais, não uma simulação espectral.
- A exposição imita um olho ou câmara que se adapta. Por isso a cena a 1 000 m é visível, quando na realidade seria escuro absoluto sem faróis.
- O detalhe procedimental do fundo não corresponde a observações daquele ponto exato. A batimetria GMRT nestes locais combina sondagens multifeixe com preenchimento por altimetria, por isso há zonas suavizadas.
- A profundidade do Challenger Deep segue Greenaway et al. (2021), 10 935 m ± 6 m. A grelha GMRT, por ser suavizada, dá cerca de 10 940 m no ponto de mergulho.
