
import importlib, traceback, sys, os

print("cwd:", os.getcwd())
print("sys.path[0]:", sys.path[0])

try:
    m = importlib.import_module("QuroBot")
    print("Imported QuroBot OK ->", getattr(m, "__name__", None))
    print("members:", [n for n in dir(m) if not n.startswith("_")][:30])
except Exception:
    traceback.print_exc()

