# wasm-build

Two builds of the same C, one for each extreme.

.debug: `make debug`
  DWARF baked into the wasm (-g3 at compile and link), plus a .wasm.map and
  sourceMappingURL section. Install the Chrome extension "C/C++ DevTools
  Support (DWARF)" and you get source stepping with variable inspection:
  hull verts, contact pairs, a body mid-drop. The source map alone only maps
  locations. If DevTools shows nothing, the browser cannot fetch the C at the
  mapped path; fix MAP_BASE, not the map. Nothing on the link line may come
  after -gsource-map that is -g0, or the name section is gone again.
  DWARF_SIDECAR=https://host/solver.debug.wasm moves the DWARF out of the
  shipped wasm if it ever gets heavy enough to make the debugger crawl.

.release: `make release`
  -O3 -flto -g0 on compile and link, closure on the glue, import/export
  strings minified, producers section off, then wasm-opt strips anything
  that survived, then brotli -q 11. Serve the .br with Content-Encoding: br.
  What is left to read is the exported function list you chose in EXPORTS,
  so keep that to one entry point and the allocator.

.audit: `make audit`
  Prints every section in both wasm files. Debug should show name, .debug_*
  and sourceMappingURL. Release should show none of them.

Variables: EMCC SRC OBJ_DIR OUT_DIR NAME EXPORTS RUNTIME MAP_BASE DWARF_SIDECAR
