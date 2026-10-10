// Steps a built ocean.wasm under Node the way solver.worker.js does in
// the browser, one thread: loads the scene, runs N steps, prints the
// step time and a hash of the poses. usage: node run-node.mjs ocean.wasm <physics dir with ocean.b3sc and lib/scoop.mjs> [steps]
import { readFileSync } from 'node:fs';
const [,, wasmPath, physicsDir, stepsArg] = process.argv;
const scenePath = physicsDir + '/ocean.b3sc';
const { scoopBytes } = await import(physicsDir + '/lib/scoop.mjs');
const steps = +(stepsArg || 120);
const mem = new WebAssembly.Memory({ initial: 4096, maximum: 16384, shared: true });
const text = new TextDecoder(); let line = '';
const wasi = { wasi_snapshot_preview1: {
  fd_close: () => 0, fd_seek: () => 70, sched_yield: () => 0,
  fd_fdstat_get: (fd, p) => { new Uint8Array(mem.buffer, p, 24).fill(0); new Uint8Array(mem.buffer)[p] = 2; return 0; },
  clock_time_get: (id, prec, p) => { new DataView(mem.buffer).setBigUint64(p, BigInt(Math.round(performance.now() * 1e6)), true); return 0; },
  fd_write: (fd, iov, n, done) => { const v = new DataView(mem.buffer); let t = 0;
    for (let i = 0; i < n; i++) { const p = v.getUint32(iov + i * 8, true), l = v.getUint32(iov + i * 8 + 4, true);
      line += text.decode(new Uint8Array(mem.buffer, p, l).slice()); t += l; }
    v.setUint32(done, t, true); if (line.endsWith('\n')) { process.stderr.write('[solver] ' + line); line = ''; } return 0; },
} };
const t0 = performance.now();
const module = await WebAssembly.compile(readFileSync(wasmPath));
const ex = new WebAssembly.Instance(module, { env: { memory: mem }, ...wasi }).exports;
ex._initialize();
const scene = readFileSync(scenePath);
const p = ex.scene_alloc(scene.length);
new Uint8Array(mem.buffer, p, scene.length).set(scene);
ex.scene_quadrant(0); ex.scene_saucers(0); ex.scene_cap(1024);
ex.scene_chassis(0); ex.scene_stand(0); ex.scene_hinge(0);
const sc = scoopBytes(), sp = ex.scene_alloc(sc.length);
new Uint8Array(mem.buffer, sp, sc.length).set(sc);
ex.scene_scoops(sp, sc.length);
const n = ex.scene_load(p, scene.length, 1, 4, 1);
ex.game_set(2, 2, 3600);
console.log(`loaded ${n} pieces in ${(performance.now() - t0).toFixed(0)} ms; exports ${Object.keys(ex).length}`);
let total = 0, worst = 0;
for (let i = 0; i < steps; i++) { const ms = ex.scene_step(); total += ms; worst = Math.max(worst, ms); }
const poses = new Float32Array(mem.buffer, ex.scene_poses(), n * 7);
let h = 2166136261; for (const f of poses) { h ^= Math.round(f * 1000) & 0xffff; h = Math.imul(h, 16777619) >>> 0; }
console.log(`${steps} steps: avg ${(total / steps).toFixed(2)} ms, worst ${worst.toFixed(2)} ms, awake ${ex.scene_awake()}, lost ${ex.scene_lost()}, poses hash ${h.toString(16)}`);
