#!/bin/sh
# Two builds of ocean.wasm, the Box3D solver behind 10-craft.com/play.
#
#   ./build.sh debug    crystalline: DWARF in the wasm, name section,
#                       Box3D asserts on, -O1 so locals are still real;
#                       a source map beside it, made from that DWARF
#   ./build.sh release  mud: -O3, every name gone, no custom sections at
#                       all, only the page's own exports left readable
#   ./build.sh audit    what each output carries, section by section
#   ./build.sh check    step a build under Node on the site's scene and
#                       hash the poses (PHYSICS=dir with ocean.b3sc)
#
# Reconstructed from the shipped ocean.wasm (its imports, exports, memory
# and stack, the sections it carries) and the sources it maps to. The
# shape of the link is exact: wasm32-wasi reactor, shared memory
# imported as env.memory, 4096 pages first and 16384 at most, an 8 MB
# stack placed first, __stack_pointer exported for the helper workers,
# and the 53 scene_/truck_/machine_/game_/w_/worker exports the page
# calls. Three things are guesses: the -O level the shipped build used,
# whether it had NDEBUG, and which SSE2-on-wasm shim it compiled
# box3d/src/simd_sse2.h against (Emscripten's compat headers are what
# COMPAT points at here; -D__SSE__ -D__SSE2__ is what lets them in on a
# non-emcc clang).
set -eu
MODE=${1:-debug}
HERE=$(cd "$(dirname "$0")" && pwd)
ZIG=${ZIG:-zig}
# the tree with ocean.c, wasm_threads.c, wasm_sem.c and box3d/
SRC=${SRC:-$HERE/../src}
# a directory holding xmmintrin.h and emmintrin.h written over
# wasm_simd128.h (Emscripten's system/include/compat is one)
COMPAT=${COMPAT:-$HERE/compat}
OUT=${OUT:-$HERE/out/$MODE}
# where the C will be served from, for DWARF's compilation dir and the
# source map's sources; the shipped site serves it at /physics/src/
SRC_URL=${SRC_URL:-https://10-craft.com/physics}
# the map's sourceMappingURL, relative to the wasm
MAP_URL=${MAP_URL:-ocean.wasm.map}
PY=${PYTHON:-python3}

FILES=$(sed 's|^|'"$SRC"'/|' "$HERE/sources.txt")
EXPORTS=$(sed 's|^|-Wl,--export=|' "$HERE/exports.txt")

# __EMSCRIPTEN__ is not emcc: it is the switch that puts Box3D's
# core.h on B3_PLATFORM_WASM and its timer.c on the clock_gettime,
# sched_yield and pthread branch, which the shipped module's imports
# show it took (the thread shims in wasm_threads.c stand in for pthread).
COMMON_C="-target wasm32-wasi -mexec-model=reactor
  -mcpu=generic+simd128+bulk_memory+atomics -D__EMSCRIPTEN__
  -std=c17 -D_POSIX_C_SOURCE=200809L -ffp-contract=off -w
  -DBROWSER -DWASM_THREADS -D__SSE__ -D__SSE2__
  -Dpthread_mutex_init=wt_init -Dpthread_mutex_destroy=wt_destroy
  -Dpthread_mutex_lock=wt_lock -Dpthread_mutex_unlock=wt_unlock
  -I$COMPAT -I$SRC/box3d/include -I$SRC/box3d/src"
COMMON_LD="-Wl,--shared-memory -Wl,--import-memory
  -Wl,--initial-memory=268435456 -Wl,--max-memory=1073741824
  -Wl,-z,stack-size=8388608 -Wl,--export=__stack_pointer
  -Wl,--export=__wasm_init_tls -Wl,--export=__tls_size $EXPORTS"

audit() {
  for w in "$HERE"/out/debug/ocean.wasm "$HERE"/out/release/ocean.wasm; do
    [ -f "$w" ] && "$PY" -I "$HERE/wasm-sections.py" "$w"
  done
}

case "$MODE" in
debug)
  mkdir -p "$OUT"
  # -g3 is DWARF with macros; -O1 keeps most locals addressable without
  # the solver crawling (-O0 if stepping through inlined hull code
  # jumps). The compilation dir is the URL the C is served under, so
  # DevTools' C/C++ DWARF extension can fetch src/ocean.c straight from
  # the site; add the same mapping under the extension's path
  # substitutions if a build of Chrome won't follow a URL comp dir.
  # Asserts: Box3D's own come on without NDEBUG; ocean.c's CHECK is
  # always on.
  $ZIG cc $COMMON_C -O1 -g3 -DB3_ENABLE_ASSERT \
    -fdebug-compilation-dir="$SRC_URL" -fdebug-prefix-map="$SRC=src" \
    $COMMON_LD $FILES -o "$OUT/ocean.wasm"
  # the source map, from that DWARF: sources named as the site serves
  # them, contents embedded; writes the sourceMappingURL section too
  # (Zig's own libc and compiler_rt units are named under src/zig/lib,
  # as the shipped map names them.)
  if [ -f "$HERE/wasm-sourcemap.py" ]; then
    ZIG_LIB=$($ZIG env | sed -n 's/.*lib_dir[" =]*"\([^"]*\)".*/\1/p')
    "$PY" -s "$HERE/wasm-sourcemap.py" "$OUT/ocean.wasm" \
      --dwarfdump="${DWARFDUMP:-$(command -v llvm-dwarfdump)}" \
      --prefix "$SRC_URL/=" "$ZIG_LIB=src/zig/lib" \
      --load-prefix "$SRC_URL/src=$SRC" \
      --sources -w "$OUT/ocean.wasm" -u "$MAP_URL" -o "$OUT/ocean.wasm.map"
  fi
  ;;
release)
  mkdir -p "$OUT"
  # -O2 as build_mt.sh ships; -g0 both sides; hidden visibility so only the listed exports reach
  # the export section; --strip-all drops the name section and, with
  # Zig's wasm-ld, the producers and target_features sections. The
  # python pass after is belt and braces: it removes every custom
  # section whatever the linker left, so the audit can be trusted.
  $ZIG cc $COMMON_C -O2 -g0 -DNDEBUG -fvisibility=hidden ${LTO:+-flto} \
    $COMMON_LD ${LTO:+-flto} -Wl,--strip-all \
    $FILES -o "$OUT/ocean.wasm"
  "$PY" -I "$HERE/wasm-strip-custom.py" "$OUT/ocean.wasm"
  # precompressed, for Content-Encoding: br (gzip if no brotli)
  if command -v brotli >/dev/null; then brotli -f -q 11 "$OUT/ocean.wasm"
  else gzip -9 -k -f "$OUT/ocean.wasm"; fi
  ;;
audit) audit ;;
check)
  # steps a build under Node on the shipped scene, as solver.worker.js
  # would, and prints a hash of the poses: the same scene stepped by
  # the same code gives the same hash, so a rebuild can be held against
  # the module the site serves. PHYSICS is a directory holding
  # ocean.b3sc and lib/scoop.mjs (a checkout of the site's /physics/).
  node "$HERE/run-node.mjs" "$HERE/out/${2:-release}/ocean.wasm" \
    "${PHYSICS:?set PHYSICS to a dir with ocean.b3sc and lib/scoop.mjs}" \
    "${3:-120}"
  ;;
*) echo "usage: $0 debug|release|audit|check [debug|release] [steps]" >&2; exit 2 ;;
esac
