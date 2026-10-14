/* Basemaps — the site's single source of keyless raster tile providers.
   CARTO's basemaps.cartocdn.com started answering every tile with an
   "API KEY REQUIRED" watermark (out/2026), so every Leaflet map (Explorar,
   Portugal, Eventos, Ocorrências, F1) now draws from here instead of
   hard-coding URLs. All sources below are free, keyless, attribution-only. */
(function () {
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const OSM_ATTR  = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const ESRI_ATTR = '© <a href="https://www.esri.com/">Esri</a>';
  const SAT_ATTR  = 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics';

  /* url, attribution, native max zoom (beyond it Leaflet upscales instead of
     requesting tiles that don't exist), optional label overlay drawn above. */
  const TILES = {
    satellite: { url: ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: SAT_ATTR, native: 19,
                 labels: ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' },
    street:    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: OSM_ATTR, native: 19 },
    topo:      { url: ESRI + 'World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr: ESRI_ATTR, native: 19 },
    dark:      { url: ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: ESRI_ATTR + ', HERE, Garmin, ' + OSM_ATTR, native: 16,
                 labels: ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}' },
    light:     { url: ESRI + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: ESRI_ATTR + ', HERE, Garmin, ' + OSM_ATTR, native: 16,
                 labels: ESRI + 'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}' },
  };

  /* Leaflet tile layer for a style. opts.labels:true adds the style's label
     overlay (returned as a LayerGroup so callers add/remove one thing). */
  function layer(name, opts) {
    const t = TILES[name] || TILES.street;
    const o = opts || {};
    const base = L.tileLayer(t.url, {
      attribution: t.attr,
      maxNativeZoom: t.native,
      maxZoom: o.maxZoom || 19,
      detectRetina: !!o.retina,
      keepBuffer: o.keepBuffer || 2,
      crossOrigin: o.crossOrigin,
      className: o.className,
    });
    if (!o.labels || !t.labels) return base;
    const lab = L.tileLayer(t.labels, {
      maxNativeZoom: t.native, maxZoom: o.maxZoom || 19,
      minZoom: o.labelsMinZoom || 0, pane: o.labelsPane || 'shadowPane',
    });
    return L.layerGroup([base, lab]);
  }

  window.Basemaps = { TILES, layer };
})();
