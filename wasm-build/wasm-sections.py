import sys, struct

def leb(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1
        r |= (c & 0x7f) << s; s += 7
        if not c & 0x80: return r, i

KNOWN = ['custom','type','import','function','table','memory','global','export',
         'start','element','code','data','datacount','tag']

def main(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'\0asm', 'not a wasm file'
    i, total = 8, len(b)
    exports = names = debug = 0
    print(path, total, 'bytes')
    while i < total:
        sid = b[i]; i += 1
        size, i = leb(b, i)
        end = i + size
        if sid == 0:
            nlen, j = leb(b, i)
            name = b[j:j+nlen].decode('utf-8', 'replace')
            print('  custom %-28s %8d' % (name, size))
            if name == 'name': names += 1
            if name.startswith('.debug') or name == 'sourceMappingURL' or name == 'external_debug_info': debug += 1
        elif sid == 7:
            n, j = leb(b, i)
            for _ in range(n):
                nlen, j = leb(b, j)
                nm = b[j:j+nlen]; j += nlen + 1
                _, j = leb(b, j)
                exports += 1
                if exports <= 12: print('  export', nm.decode('utf-8','replace'))
            if exports > 12: print('  ... %d exports total' % exports)
        else:
            k = KNOWN[sid] if sid < len(KNOWN) else str(sid)
            print('  %-35s %8d' % (k, size))
        i = end
    print('  name section:', 'yes' if names else 'no', '| debug sections:', debug)

for p in sys.argv[1:]: main(p)
