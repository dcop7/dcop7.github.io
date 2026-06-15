# 3D anatomy models — credits & licence

The per-system 3D models in this folder (`esqueletico.glb`, `muscular.glb`,
`circulatorio.glb`, `respiratorio.glb`, `nervoso.glb`, `digestivo.glb`,
`urinario.glb`, `sentidos.glb`) are derived from **BodyParts3D**.

> **BodyParts3D**, © The Database Center for Life Science (DBCLS),
> licensed under **Creative Commons Attribution-ShareAlike 2.1 Japan
> (CC BY-SA 2.1 JP)**.
> Source: https://lifesciencedb.jp/bp3d/ — release 3.0 (`obj_99`).
> Citation: Mitsuhashi N, *et al.* "BodyParts3D: 3D structure database for
> anatomical concepts." *Nucleic Acids Research* 37 (2009): D782–D785.

## What was done
The original BodyParts3D parts are individual OBJ meshes, all in one shared
coordinate space. Our pipeline (`tools/anatomy/`, Node + glTF-Transform +
meshoptimizer — no Blender) selects a curated set of structures per anatomical
system, normalises the shared coordinate space (stand upright, feet at floor,
centred), merges the parts of each structure into one named, pickable node,
simplifies and meshopt-compresses the result, and writes one GLB per system.

No anatomical meaning was changed — only polygon count / file size were reduced
and structures were grouped per system for navigation.

## Licence note (ShareAlike)
Because BodyParts3D is **CC BY-SA**, these derived GLB files are likewise
distributed under **CC BY-SA** (attribution above + share-alike). This applies
to the **model files only** — the site's own code, UI and the educational text
in `data/anatomy/manifest.json` are original work and are not affected by the
ShareAlike term.

Attribution is also recorded in the repository's `ASSET-LICENSE-AUDIT.md`.
