import shutil, subprocess
from subprocess import PIPE
def check_call(cmd, stdout=None, stderr=None, **kw):
    return subprocess.run(cmd, stdout=stdout, stderr=stderr, check=True, text=True, **kw)
def llvm_tool_path(name): return shutil.which(name) or name
