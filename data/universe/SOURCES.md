# Universo observável — fontes, licenças e aproximações

Dados do separador **Explorar › Universo** (`js/explorer/universe/`). Tudo o que está
nesta pasta é gerado por `tools/universe/fetch.mjs` (descarrega para `tools/universe/_src/`,
ignorado pelo git) e `tools/universe/build.mjs` (escreve aqui). Nada é aleatório: cada
ponto desenhado corresponde a uma linha de um catálogo publicado. As únicas exceções estão
na secção "Modelos" e aparecem na interface com o selo **MODELO** ou **HIPOTÉTICO**.

## Catálogos (dados factuais, de distribuição livre)

| Ficheiro | Conteúdo | Fonte | Licença / condições |
|---|---|---|---|
| `stars.bin`, `stars.json` | 12 289 estrelas (posição 3D, Mv, B−V, nome, tipo espectral) | **Gliese & Jahreiß, CNS3** (1991) + **Yale Bright Star Catalogue 5.ª ed.** (Hoffleit & Warren 1991), via NASA HEASARC | Dados científicos públicos (NASA HEASARC). Nomes em português e figuras das constelações: trabalho deste projeto (reaproveitados de `data/sky/stars.json`). |
| `exo.bin`, `exo.json` | ~4 500 estrelas com planetas e os seus planetas | **NASA Exoplanet Archive**, tabela PSCompPars | Uso livre; agradecimento pedido: *"This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with NASA under the Exoplanet Exploration Program."* |
| `mw.json` | 199 masers com paralaxe, 157 enxames globulares, 2 039 enxames abertos, parâmetros dos braços | **Reid et al. 2019**, ApJ 885, 131 (tabelas do e-print arXiv:1910.03357); **Harris** (1996, ed. 2010); **Dias et al.** (2002), via HEASARC | Factos científicos publicados; citados aqui e no painel. |
| `lg.json` | 142 galáxias do Grupo Local e arredores | **McConnachie 2012**, AJ 144, 4 — "Nearby Dwarf Database" (cópia do Internet Archive; o site original recusa pedidos automáticos) | Factos científicos publicados. |
| `galaxies.json` | 774 galáxias brilhantes (B_T < 12,5) com forma, orientação e tipo | **RC3** (de Vaucouleurs et al. 1991), via HEASARC | Dados científicos públicos. |
| `gal-local.bin` | 37 579 galáxias com redshift | **ZCAT** (Huchra et al., CfA Redshift Catalog), via HEASARC | Dados científicos públicos. |
| `clusters.json` | 1 059 enxames de Abell com redshift | **Abell, Corwin & Olowin 1989** (ACO) + redshifts compilados (HEASARC `abellzcat`) | Dados científicos públicos. |
| `sdss.bin`, `deep.bin`, `deep-meta.json` | 260 791 + 72 062 galáxias e 90 000 quasares (amostras por `fiberID`) | **Sloan Digital Sky Survey DR18** (SkyServer SQL) | Dados públicos; agradecimento: *"Funding for the Sloan Digital Sky Survey has been provided by the Alfred P. Sloan Foundation, the participating institutions, NASA, NSF and the U.S. Department of Energy. The SDSS web site is www.sdss.org."* |
| `smallbody.bin`, `smallbody.json` | 55 794 órbitas (asteroides H < 15,2, troianos, transneptunianos) + vetores de 5 sondas | **JPL Small-Body Database** e **JPL Horizons** (Voyager 1/2, New Horizons, Pioneer 10/11) | NASA/JPL, domínio público. |
| `cmb.webp`, `cmb-lo.webp` | Mapa da radiação cósmica de fundo | **WMAP 9 anos, mapa ILC** (NASA LAMBDA), convertido de HEALPix para equiretangular em coordenadas galácticas; **paleta de cores nossa** | NASA, domínio público. |
| `objects.json` | 72 fichas curadas, 8 níveis, 7 viagens | Texto e escolhas deste projeto; números de referência (distâncias, massas, tamanhos) de literatura publicada | Trabalho original. |

Texturas dos planetas: `assets/planets/` (Solar System Scope, **CC BY 4.0**; Terra dia/noite: NASA,
domínio público) — já registadas em `ASSET-REGISTRY.json`. Bibliotecas: **three.js** (MIT), carregada do esm.sh.

## Deliberadamente excluído

- **Gaia DR3** — os termos de reutilização da ESA acrescentam condições (partilha nas mesmas condições) que as regras do projeto não aceitam (só domínio público, CC0, CC BY, MIT ou trabalho próprio).
- **HYG database** — CC BY-SA (partilha nas mesmas condições).
- **2MRS** — a página do catálogo proíbe redistribuição.
- **Hipparcos** (ESA) — mesmas dúvidas que a Gaia; as distâncias medidas vêm do CNS3 e da BSC5.
- Fotografias de galáxias (Hubble, JWST, ESO) — não são usadas como texturas: as galáxias são desenhadas por modelo/atlas próprio.

## Modelos e aproximações (assinalados na interface)

- **Via Láctea**: modelo volumétrico próprio — braços em espiral logarítmica com os ângulos e raios de Reid et al. 2019 (o troço extrapolado esbate-se), barra a 27°, bojo, disco exponencial (Rd 2,6 kpc), perfil vertical sech², poeira. As **posições** dos masers e enxames são medidas; o **aspeto** do disco não é uma fotografia.
- **Andrómeda, Triângulo, Nuvens de Magalhães**: o mesmo motor, com inclinação e ângulo de posição medidos, braços genéricos.
- **Galáxias RC3**: impostores com o tamanho (D25), achatamento e orientação do catálogo, textura por tipo morfológico (atlas gerado por código).
- **Tamanho mínimo**: galáxias e planetas menores do que ~1,5 px desenham-se com tamanho mínimo e brilho reduzido (conservação do fluxo).
- **Distâncias pelo redshift** (ZCAT, SDSS, Abell, quasares): cosmologia Planck 2018 (H₀ = 67,66, Ωm = 0,311), distância comóvel. Velocidades próprias deformam as estruturas ao longo da linha de vista ("dedos de Deus") — isso é real nos dados, não um defeito do desenho.
- **Estrelas**: CNS3 e paralaxes da BSC5 quando existem; para as restantes estrelas brilhantes a distância é **estimada pelo tipo espectral** (magnitude absoluta típica). A camada "Cor das estrelas pela origem da distância" mostra qual é qual. Algumas estrelas famosas usam distâncias de referência recentes (`KNOWN_LY` em `build.mjs`).
- **Brilho**: a magnitude aparente é calculada a partir da posição da câmara; ao afastar, a "exposição" sobe para as estrelas continuarem visíveis (avisado no ecrã).
- **Heliopausa** (~121 UA, distância das Voyager) e **Nuvem de Oort** (hipotética): esferas esquemáticas.
- **Sondas**: posição de 1/1/2026 (Horizons) extrapolada em linha reta.
- **CMB**: esfera a 13 870 Mpc comóveis; o limite do universo observável (~46,5 mil milhões de anos-luz) é um anel de referência.
- **Escala**: a régua é **logarítmica** (cada risco ×10); a barra de escala no canto é linear e só vale no plano do objeto em foco.
