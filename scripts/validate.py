"""Validate all benchmark and task TOML files. Exits non-zero on any error."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from catalogue import load_catalogue  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--harbor-dir", action="append", type=Path, default=None,
                        help="Extra Harbor dataset directory to scan for task.toml (repeatable)")
    args = parser.parse_args(argv)
    harbor_dirs = None
    if args.harbor_dir:
        harbor_dirs = [Path(__file__).resolve().parent.parent / "data" / "harbor", *args.harbor_dir]
    cat = load_catalogue(harbor_dirs=harbor_dirs)
    if cat.errors:
        for err in cat.errors:
            print(f"ERROR {err}", file=sys.stderr)
        print(f"{len(cat.errors)} error(s)", file=sys.stderr)
        return 1
    print(f"OK: {len(cat.benchmarks)} benchmarks, {len(cat.tasks)} tasks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
