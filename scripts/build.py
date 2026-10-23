"""Validate TOML metadata and write data/generated/catalogue.json."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from catalogue import ROOT, load_catalogue, to_json_document  # noqa: E402

DEFAULT_OUT = ROOT / "data" / "generated" / "catalogue.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--harbor-dir", action="append", type=Path, default=None,
                        help="Extra Harbor dataset directory to scan for task.toml (repeatable)")
    args = parser.parse_args(argv)
    harbor_dirs = [ROOT / "data" / "harbor", *args.harbor_dir] if args.harbor_dir else None
    cat = load_catalogue(harbor_dirs=harbor_dirs)
    if cat.errors:
        for err in cat.errors:
            print(f"ERROR {err}", file=sys.stderr)
        return 1
    doc = to_json_document(cat)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    stats = doc["stats"]
    print(f"Wrote {args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out}: "
          f"{stats['benchmarks']} benchmarks, {stats['tasks']} tasks, "
          f"{stats['configurations']} configurations, {stats['by_verification']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
