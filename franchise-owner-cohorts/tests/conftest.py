import importlib.util
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


def load_script(stem: str):
    """Import a numbered pipeline script (e.g. '01_clean_people') as a module."""
    if stem in sys.modules:
        return sys.modules[stem]
    spec = importlib.util.spec_from_file_location(stem, SRC / f"{stem}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[stem] = mod
    spec.loader.exec_module(mod)
    return mod
