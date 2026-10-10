import os, sys
def normalize_path(p): return p.replace('\\', '/') if p else p
def path_from_root(*a): return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), *a)
def read_file(p):
    with open(p, encoding='utf-8', errors='replace') as f: return f.read()
def exit_with_error(msg, *a):
    sys.stderr.write('error: ' + (msg % a if a else msg) + '\n'); sys.exit(1)
