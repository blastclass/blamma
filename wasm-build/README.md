# ocean.wasm, two ways

The solver behind 10-craft.com/play is Box3D plus `ocean.c`, built with
Zig's clang to a `wasm32-wasi` reactor on one shared memory, and driven
from `solver.worker.js`. This directory builds that same module two
ways from the same sources:

- `./build.sh debug` is the crystalline one. DWARF in the wasm, a name
  section, Box3D's asserts on, `-O1` so locals are still real, and a
  source map beside it made from that DWARF.
- `./build.sh release` is the mud. `-O3`, no names, no custom sections
  of any kind. Only the exports the page calls stay readable.

`./build.sh audit` lists what each output carries, section by section.
`./build.sh check debug|release` steps a build under Node on the site's
own scene and prints a hash of the poses.

## What the shipped module is

Read off `https://10-craft.com/physics/ocean.wasm` and the map beside
it, 2026-10-10 (`version.txt` e0e772823ec9):

- Imports: `env.memory`, shared, 4096 pages first and 16384 at most;
  six WASI calls (`fd_write`, `fd_close`, `fd_seek`, `fd_fdstat_get`,
  `clock_time_get`, `sched_yield`). Nothing from Emscripten.
- Exports: `_initialize` (reactor), `__stack_pointer`, `__tls_size`,
  `__wasm_init_tls`, then 53 `scene_` / `truck_` / `machine_` /
  `game_` / `w_` / `worker_main` / `workers_ready` entry points.
  The list is in `exports.txt`, taken straight from the module.
- Stack: 8 MB, placed first (the initial `__stack_pointer` is
  0x800000). Helper workers get their own 8 MB from `scene_alloc`.
- Custom sections: only `sourceMappingURL`. No name section, no
  producers, no `.debug_*`.
- The map, `ocean.wasm.map`, is 3.2 MB and carries `sourcesContent`
  for every one of its 146 files: all of `ocean.c`, `wasm_threads.c`,
  `wasm_sem.c`, Box3D, and the parts of Zig's libc that were linked.
  The same tree is also served plainly under `/physics/src/`.

So today's production build is neither of the two targets. It is a
release build with the full source bolted on. Anyone who opens DevTools
on `/play` gets the C, by name and by line, without asking. If the mud
is wanted, the release target below is what to ship, and the map must
not be served with it.

## How this build was fitted

There is no build script under `/physics/`, so the flags were worked
back from the module and checked by rebuilding it:

- Compiled with Zig 0.17.0 (`zig cc`), from the sources the map
  embeds (`sources.txt` is the list of `.c` files the map says went
  in, plus `box3d/src/wide4.c`, which the map could not list because
  every line of it belongs to the two `.inl` files it includes).
- The rebuilt release and the shipped module, stepped on the shipped
  scene (`ocean.b3sc`) under Node for 120 steps, one thread, produce the
  same poses hash (`d559e1e4`), the same piece count (1096), the same
  awake count (1039). The debug build does too. Trajectory-identical.
- Rebuilt release: 594,661 bytes against the shipped 588,393. The
  gap is the unknowns below.
- Export list and import list of both rebuilds are equal to the
  shipped module's, name for name.

Three things are still guesses, each marked in `build.sh`:

1. The `-O` level of the shipped build. Release here uses `-O3`.
2. Whether the shipped build had `NDEBUG`. Release here does; debug
   defines `B3_ENABLE_ASSERT` instead. `ocean.c`'s own `CHECK` is
   always on.
3. The SSE2-on-wasm shim. Box3D's `core.h` picks the SSE2 path for
   wasm when `__EMSCRIPTEN__` is defined, and `simd_sse2.h` then
   includes `<emmintrin.h>`. Zig's clang refuses that header on
   wasm, so the build machine supplies its own. `compat/` here holds
   Emscripten's `xmmintrin.h` and `emmintrin.h` with one change: `__m128`
   is a clang `ext_vector_type(4)` instead of a plain vector, because
   `contact_solver_wide.inl` reads `.x` off a lane type and nothing
   else lets that compile. Whatever shim the real build uses must do
   the same.

`-D__EMSCRIPTEN__` is not an emcc build. It is the switch that puts
Box3D's `core.h` on `B3_PLATFORM_WASM` and its `timer.c` on the
`clock_gettime` / `sched_yield` / pthread branch, which the shipped
module's imports show it took (`wasm_threads.c` stands in for pthread
through `-Dpthread_mutex_lock=wt_lock` and friends). Without it the
module links but takes a different timer and loses two imports.

## Debug: using it

Chrome (or Edge) with the "C/C++ DevTools Support (DWARF)" extension.
Firefox and Safari read the source map only, which gives lines and
stepping but no variables.

The DWARF names its files `src/ocean.c`, `src/box3d/src/solver.c` and
so on under the compilation dir `https://10-craft.com/physics`, which is
where the site serves them. If the extension does not fetch them on its
own, open its options and add one path substitution, from
`https://10-craft.com/physics` to a local checkout of the same tree.
Then a breakpoint in `scene_step` shows `hz`, `substeps`, the body
arrays, a hull's vertices, a contact pair, mid-step.

Zig compiles its libc separately and stamps those units with the
directory it was first run from, so libc frames show that path. The map
renames them to `src/zig/lib/...` as the shipped map does.

Sizes: 6.2 MB wasm, 3.1 MB map. Fine at this scale. If the DWARF ever
gets heavy enough to make the debugger sluggish, the extension can
follow an `external_debug_info` custom section to a sidecar file that
holds the `.debug_*` sections alone. That is not wired here; it is not
needed at this size.

## Release: what the veil holds

- No name section, no producers, no target features, no map, no
  `sourceMappingURL`. `wasm-strip-custom.py` runs after the link and
  removes every custom section whatever the linker left, so `audit`
  can be trusted. Confirmed: the rebuilt release has zero custom
  sections.
- `-fvisibility=hidden` plus an explicit `--export` list, so Box3D's
  own `b3*` entry points do not reach the export section.
- What stays readable: the 57 export names (the page needs them), the
  six WASI import names, and string literals. `ocean.c`'s `CHECK`
  stringifies its condition and `__LINE__`, so the release still
  contains lines like `ocean: assert r >= 0 && r < CHASSIS line 57`.
  Those are the one window left. A `-DCHECK(c)=((void)0)` build would
  close it, at the cost of the aborts; a `CHECK` that prints only the
  line number would close most of it for free.
- Serve `ocean.wasm.br`, or let the server gzip it as it does now
  (gzip takes 594 KB to 229 KB; brotli at quality 11 does a little
  better). Do not serve `ocean.wasm.map` next to it, and remove the
  `/physics/src/` location, or the mud is decorative.
- `-flto` is wired as an option (`LTO=1 ./build.sh release`) but off
  by default; it was not needed to match the shipped size.

## Files

- `build.sh`: the two targets, `audit`, `check`. Knobs through the
  environment: `ZIG`, `SRC` (the tree with `ocean.c` and `box3d/`),
  `COMPAT`, `OUT`, `SRC_URL`, `MAP_URL`, `PHYSICS`, `LTO`.
- `sources.txt`, `exports.txt`: what goes in, what comes out.
- `compat/`: the SSE2 shim headers, Emscripten's with the one change.
- `wasm-sections.py`: section listing, used by `audit`.
- `wasm-strip-custom.py`: removes custom sections in place.
- `wasm-sourcemap.py`: Emscripten's, unchanged; `tools/` holds the four
  stand-in modules it needs to run outside an emsdk.
- `run-node.mjs`: the `check` harness. Mirrors `solver.worker.js`'s
  start-up on one thread and steps.

Needed on the machine: `zig`, `llvm-dwarfdump` (for the map), `node`
(for `check`), `python3`. `brotli` if present.
