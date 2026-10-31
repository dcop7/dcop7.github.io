/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — núcleo: three.js (mesma versão/CDN que o Corpo Humano,
   para partilhar a cache e a instância), patch de shading e utilitários.

   O three.js não dá sombras às RectAreaLight. Cada luz do estúdio é por
   isso um PAR: uma SpotLight (que projeta a sombra e carrega a parte
   "dura" do feixe) + uma RectAreaLight (a parte larga, com o tamanho real
   do difusor). O patch abaixo faz a luz de área i usar a sombra da spot i,
   com um filtro Poisson cujo raio cresce com o tamanho do modificador.
   É uma aproximação (a penumbra não é calculada a partir da área real),
   e o texto da interface di-lo.
   ══════════════════════════════════════════════════════════════════════ */
const CDN = 'https://esm.sh/three@0.160.0';
export const THREE = await import(CDN);
const [{ GLTFLoader }, { OrbitControls }, { TransformControls }, { RectAreaLightUniformsLib }, { RoomEnvironment }, { RoundedBoxGeometry }] = await Promise.all([
  import(CDN + '/examples/jsm/loaders/GLTFLoader.js'),
  import(CDN + '/examples/jsm/controls/OrbitControls.js'),
  import(CDN + '/examples/jsm/controls/TransformControls.js'),
  import(CDN + '/examples/jsm/lights/RectAreaLightUniformsLib.js'),
  import(CDN + '/examples/jsm/environments/RoomEnvironment.js'),
  import(CDN + '/examples/jsm/geometries/RoundedBoxGeometry.js'),
]);
export { GLTFLoader, OrbitControls, TransformControls, RoomEnvironment, RoundedBoxGeometry };
RectAreaLightUniformsLib.init();

/* ── patch de shading ───────────────────────────────────────────────── */
const POISSON = [
  [-0.94201624, -0.39906216], [0.94558609, -0.76890725], [-0.09418410, -0.92938870], [0.34495938, 0.29387760],
  [-0.91588581, 0.45771432], [-0.81544232, -0.87912464], [-0.38277543, 0.27676845], [0.97484398, 0.75648379],
  [0.44323325, -0.97511554], [0.53742981, -0.47373420], [-0.26496911, -0.41893023], [0.79197514, 0.19090188],
  [-0.24188840, 0.99706507], [-0.81409955, 0.91437590], [0.19984126, 0.78641367], [0.14383161, -0.14100790],
];
const POISSON_GLSL = `const vec2 ST_POISSON[16] = vec2[16](${POISSON.map(p => `vec2(${p[0]},${p[1]})`).join(',')});\n`;

const PCF_SOFT = `#if defined( SHADOWMAP_TYPE_PCF )
			/* estúdio: disco de Poisson rodado por píxel — penumbra contínua,
			   sem as bandas do filtro de 17 amostras quando o raio é grande */
			float stA = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
			float stS = sin( stA ), stC = cos( stA );
			vec2 stT = vec2( max( shadowRadius, 1.0 ) ) / shadowMapSize;
			float stAcc = 0.0;
			for ( int k = 0; k < 16; k ++ ) {
				vec2 o = ST_POISSON[ k ];
				o = vec2( stC * o.x - stS * o.y, stS * o.x + stC * o.y );
				stAcc += texture2DCompare( shadowMap, shadowCoord.xy + o * stT, shadowCoord.z );
			}
			shadow = stAcc / 16.0;
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )`;

let _chunks = null;
function patchedChunks() {
  if (_chunks) return _chunks;
  const C = THREE.ShaderChunk;
  /* 1) filtro de sombra */
  let sm = C.shadowmap_pars_fragment;
  const g = sm.indexOf('float getShadow( sampler2D shadowMap');
  const a = sm.indexOf('#if defined( SHADOWMAP_TYPE_PCF )', g);
  const b = sm.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )', a);
  const okPcf = g > 0 && a > 0 && b > a;
  if (okPcf) sm = sm.slice(0, a) + PCF_SOFT + sm.slice(b + '#elif defined( SHADOWMAP_TYPE_PCF_SOFT )'.length);

  /* 2) sombras das spots calculadas uma vez e partilhadas com as luzes de área */
  let lf = C.lights_fragment_begin;
  const spotShadowCall = /directLight\.color \*= \( directLight\.visible && receiveShadow \) \? getShadow\( spotShadowMap\[ i \][^;]*vSpotLightCoord\[ i \] \) : 1\.0;/;
  const okSpot = spotShadowCall.test(lf);
  const pre = `
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	float stSh[ NUM_SPOT_LIGHT_SHADOWS ];
	SpotLightShadow stSls;
	float stOn;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		stSls = spotLightShadows[ i ];
		/* ranhuras livres (cor 0) não gastam as 16 amostras de sombra */
		stOn = dot( spotLights[ i ].color, vec3( 1.0 ) );
		#if ( UNROLLED_LOOP_INDEX < NUM_RECT_AREA_LIGHTS )
			stOn += dot( rectAreaLights[ i ].color, vec3( 1.0 ) );
		#endif
		stSh[ i ] = ( receiveShadow && stOn > 0.0 ) ? getShadow( spotShadowMap[ i ], stSls.shadowMapSize, stSls.shadowBias, stSls.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
`;
  const rectLoop = 'RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const okRect = lf.includes(rectLoop) && lf.includes('#if ( NUM_SPOT_LIGHTS > 0 )');
  if (okSpot && okRect) {
    lf = lf.replace('#if ( NUM_SPOT_LIGHTS > 0 )', pre + '#if ( NUM_SPOT_LIGHTS > 0 )');
    lf = lf.replace(spotShadowCall, 'directLight.color *= directLight.visible ? stSh[ i ] : 1.0;');
    lf = lf.replace(rectLoop, `if ( rectAreaLight.color != vec3( 0.0 ) ) {
			vec3 stD0 = reflectedLight.directDiffuse, stS0 = reflectedLight.directSpecular;
			${rectLoop}
			#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
				reflectedLight.directDiffuse = stD0 + ( reflectedLight.directDiffuse - stD0 ) * stSh[ i ];
				reflectedLight.directSpecular = stS0 + ( reflectedLight.directSpecular - stS0 ) * stSh[ i ];
			#endif
		}`);
  }

  /* 3) pele: difusa com "wrap" por canal — o vermelho atravessa o
        terminador um pouco mais do que o azul (subsuperfície barata) */
  let lp = C.lights_physical_pars_fragment;
  const diffLine = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
  const iDirect = lp.indexOf('void RE_Direct_Physical(');
  const iLine = lp.indexOf(diffLine, iDirect);
  const okSkin = iDirect > 0 && iLine > 0;
  if (okSkin) lp = lp.slice(0, iLine) + `#ifdef ST_SKIN
		vec3 stW = vec3( 0.13, 0.055, 0.035 );
		vec3 stNL = clamp( ( vec3( dot( geometryNormal, directLight.direction ) ) + stW ) / ( 1.0 + stW ), 0.0, 1.0 );
		reflectedLight.directDiffuse += stNL * directLight.color * BRDF_Lambert( material.diffuseColor );
	#else
		${diffLine}
	#endif` + lp.slice(iLine + diffLine.length);

  if (!(okPcf && okSpot && okRect && okSkin)) console.warn('[st] patch parcial', { okPcf, okSpot, okRect, okSkin });
  _chunks = { sm, lf, lp, rectShadows: okSpot && okRect };
  return _chunks;
}

/** Aplica o patch a um material do estúdio (todos os que recebem luz). */
export function studioMaterial(mat, { skin = false } = {}) {
  const ch = patchedChunks();
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', POISSON_GLSL + ch.sm)
      .replace('#include <lights_fragment_begin>', ch.lf)
      .replace('#include <lights_physical_pars_fragment>', ch.lp);
    if (skin) sh.fragmentShader = '#define ST_SKIN\n' + sh.fragmentShader;
  };
  mat.customProgramCacheKey = () => 'st2' + (skin ? 's' : '');
  return mat;
}

/* ── cor ────────────────────────────────────────────────────────────── */
/** Temperatura de cor (K) → RGB linear normalizado (aproximação de
 *  Tanner Helland sobre o locus de Planck, 1000–40000 K). */
export function kelvinRGB(k) {
  const t = Math.max(1000, Math.min(40000, k)) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const lin = v => { v = Math.max(0, Math.min(255, v)) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const c = [lin(r), lin(g), lin(b)];
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return c.map(x => x / lum);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const DEG = Math.PI / 180;
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ── texturas procedurais (canvas) ──────────────────────────────────── */
export function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

/** Ruído de valor tileável, para pisos/papel/tecido. */
export function noiseField(w, h, cell, seed = 1) {
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const g = new Float32Array(gw * gh).map(rnd);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const G = (i, j) => g[((j % gh) + gh) % gh * gw + ((i % gw) + gw) % gw];
    const a = G(x0, y0), b = G(x0 + 1, y0), c = G(x0, y0 + 1), d = G(x0 + 1, y0 + 1);
    out[y * w + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  return out;
}
