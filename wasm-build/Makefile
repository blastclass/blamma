# Two-target emscripten build for the solver.
#   make debug    -> crystalline: DWARF in the wasm, source map beside it, assertions on
#   make release  -> mud: LTO, closure, no names, no debug sections, minified imports/exports
#   make audit    -> list every custom section in both outputs so you can see what leaked
#
# Drop this next to the C and point SRC/EXPORTS at the real thing.

EMCC      ?= emcc
SRC       ?= $(wildcard src/*.c)
OBJ_DIR   ?= obj
OUT_DIR   ?= dist
NAME      ?= solver
EXPORTS   ?= _solve,_malloc,_free
RUNTIME   ?= ccall,cwrap,HEAPF32,HEAPU8
# URL the browser will use to find the C files referenced by the source map.
# Default = beside the wasm. Make sure that path actually serves src/.
MAP_BASE  ?= ./
# Optional sidecar for DWARF. Leave empty to bake DWARF into the wasm.
DWARF_SIDECAR ?=

COMMON_C  := -std=c11 -Wall -fno-exceptions
COMMON_LD := -sENVIRONMENT=web -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createSolver \
             -sEXPORTED_FUNCTIONS=$(EXPORTS) -sEXPORTED_RUNTIME_METHODS=$(RUNTIME) \
             -sALLOW_MEMORY_GROWTH=1 -sFILESYSTEM=0 --no-entry

# ---------------------------------------------------------------- debug
# -g in the COMPILE step is mandatory: the map and the DWARF both come from
# per-object debug info. -O1 keeps variables inspectable; -O0 if stepping gets
# jumpy on inlined hull/contact code. Nothing after -gsource-map may be -g0.
DBG_C  := -O1 -g3 -fdebug-compilation-dir=/ $(COMMON_C)
DBG_LD := -O1 -g3 -gsource-map --source-map-base $(MAP_BASE) \
          -sASSERTIONS=2 -sSAFE_HEAP=1 -sSTACK_OVERFLOW_CHECK=2 \
          -sDEMANGLE_SUPPORT=1 -sEMIT_PRODUCERS_SECTION=0 $(COMMON_LD)
ifneq ($(DWARF_SIDECAR),)
DBG_LD += -gseparate-dwarf=$(OUT_DIR)/debug/$(NAME).debug.wasm \
          -sSEPARATE_DWARF_URL=$(DWARF_SIDECAR)
endif

# ---------------------------------------------------------------- release
# -g0 both sides. -flto needs to be on compile AND link. Closure minifies the
# JS glue; MINIFY_WASM_IMPORTS_AND_EXPORTS renames the wasm import/export
# strings so function names stop leaking through the module boundary.
REL_C  := -O3 -flto -g0 -fvisibility=hidden -DNDEBUG $(COMMON_C)
REL_LD := -O3 -flto -g0 --closure 1 \
          -sASSERTIONS=0 -sSTRICT=1 -sMINIFY_WASM_IMPORTS_AND_EXPORTS=1 \
          -sMINIFY_WASM_IMPORTED_MODULES=1 -sEMIT_PRODUCERS_SECTION=0 \
          -sEMIT_EMSCRIPTEN_LICENSE=0 -sIGNORE_CLOSURE_COMPILER_ERRORS=0 \
          $(COMMON_LD)

DBG_OBJ := $(patsubst %.c,$(OBJ_DIR)/debug/%.o,$(SRC))
REL_OBJ := $(patsubst %.c,$(OBJ_DIR)/release/%.o,$(SRC))

.PHONY: all debug release audit clean
all: debug release

debug: $(OUT_DIR)/debug/$(NAME).mjs
release: $(OUT_DIR)/release/$(NAME).mjs

$(OBJ_DIR)/debug/%.o: %.c
	@mkdir -p $(dir $@)
	$(EMCC) $(DBG_C) -c $< -o $@

$(OBJ_DIR)/release/%.o: %.c
	@mkdir -p $(dir $@)
	$(EMCC) $(REL_C) -c $< -o $@

$(OUT_DIR)/debug/$(NAME).mjs: $(DBG_OBJ)
	@mkdir -p $(dir $@)
	$(EMCC) $(DBG_LD) $^ -o $@

$(OUT_DIR)/release/$(NAME).mjs: $(REL_OBJ)
	@mkdir -p $(dir $@)
	$(EMCC) $(REL_LD) $^ -o $@
	# belt and braces: wasm-opt is bundled with emsdk; strip whatever survived
	wasm-opt --strip-debug --strip-producers --strip-target-features \
	         $(OUT_DIR)/release/$(NAME).wasm -o $(OUT_DIR)/release/$(NAME).wasm
	# ship precompressed; serve with Content-Encoding: br
	-brotli -f -q 11 $(OUT_DIR)/release/$(NAME).wasm
	-brotli -f -q 11 $(OUT_DIR)/release/$(NAME).mjs

audit:
	@for w in $(OUT_DIR)/debug/$(NAME).wasm $(OUT_DIR)/release/$(NAME).wasm; do \
	  [ -f $$w ] && python3 -I wasm-sections.py $$w; done

clean:
	rm -rf $(OBJ_DIR) $(OUT_DIR)
