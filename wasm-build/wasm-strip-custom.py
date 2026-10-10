#!/usr/bin/env python3
"""Remove every custom section from a wasm file, in place.
usage: wasm-strip-custom.py file.wasm [keep-name ...]
Names given after the file are kept (e.g. sourceMappingURL)."""
import sys
def leb(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if not c & 0x80: return r, i
def main(path, keep):
    b = open(path, 'rb').read()
    out = bytearray(b[:8]); i = 8; dropped = []
    while i < len(b):
        start = i; sid = b[i]; i += 1; n, i = leb(b, i); end = i + n
        if sid == 0:
            l, j = leb(b, i); name = b[j:j+l].decode('utf-8', 'replace')
            if name not in keep:
                dropped.append((name, end - start)); i = end; continue
        out += b[start:end]; i = end
    open(path, 'wb').write(out)
    for name, size in dropped: print(f"stripped {name} ({size} bytes)")
    print(f"{path}: {len(b)} -> {len(out)} bytes")
if __name__ == '__main__': main(sys.argv[1], set(sys.argv[2:]))
