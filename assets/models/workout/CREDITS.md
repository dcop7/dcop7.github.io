# Workout 3D mannequin — credits & licence

All assets here are **CC0 1.0 Universal (public domain)** — free for any use,
including commercial, with no attribution required. Sourced from the
**Mesh2Motion** project (https://mesh2motion.org · https://github.com/Mesh2Motion),
whose 3D models, rigs and animations are released CC0 (see its `LICENSE-CC0.MD`).
Credits below are recorded as good practice (not legally required by CC0).

| File | Content | Author | Licence |
|------|---------|--------|---------|
| `mannequin.glb` | Rigged neutral humanoid ("Mannequin", 66-joint skeleton) | **Quaternius** (via Mesh2Motion) | CC0 1.0 |
| `base-anim.glb` | Animation clips: Walk_Loop, Jog_Fwd_Loop, Sprint_Loop, Crouch_Idle_Loop, Jump_Loop, Chest_Open, Idle_Loop | **Mesh2Motion** (original, Blender) | CC0 1.0 |
| `addon-anim.glb` | Animation clips: Pushup, Jumping Jacks, Run Anime, Meditate, Rest Pose | **Mesh2Motion** (original, Blender) | CC0 1.0 |

Some exercises with no available free mocap (squat, lunge, high-knees, plank,
crunch) are animated by **original keyframe clips we authored** on this same CC0
mannequin skeleton at runtime — those are our own work (project-owned), so the
whole feature stays free of third-party licensing obligations.

Processing: downloaded from the Mesh2Motion repo, trimmed to the clips used,
mesh/material stripped from the animation files, and keyframes `resample()`d
(gltf-transform) for the web. The animation clips share the mannequin's skeleton
so they bind by bone name at runtime (Three.js `AnimationMixer`).

NOT used (kept out on purpose): the `human-jay/sintel/bunny` (Blender Studio,
CC-BY) and `human-sophia` (CC-SA) variations — only the CC0 Quaternius mannequin
is bundled, to keep everything attribution-free and redistributable.
