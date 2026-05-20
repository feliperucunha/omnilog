#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

MUSIC_SUFFIXES = frozenset({".flac", ".mp3"})
SEPARATOR = " - "
INVALID_NAME_CHARS = re.compile(r'[/\\:*?"<>|]')


def is_music_file(path: Path) -> bool:
    return path.suffix.lower() in MUSIC_SUFFIXES


def parse_filename(path: Path) -> tuple[str, str] | None:
    if not is_music_file(path):
        return None
    stem = path.stem
    if SEPARATOR not in stem:
        return None
    artist, song = stem.split(SEPARATOR, 1)
    artist = artist.strip()
    song = song.strip()
    if not artist or not song:
        return None
    return artist, song


def sanitize_folder_name(name: str) -> str:
    cleaned = INVALID_NAME_CHARS.sub("_", name).strip()
    cleaned = cleaned.rstrip(".")
    return cleaned or "_"


def unique_destination(folder: Path, filename: str) -> Path:
    target = folder / filename
    if not target.exists():
        return target
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    counter = 2
    while True:
        candidate = folder / f"{stem} ({counter}){suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def collect_files(source: Path, recursive: bool) -> list[Path]:
    if not source.is_dir():
        raise NotADirectoryError(f"Not a directory: {source}")
    iterator = source.rglob("*") if recursive else source.iterdir()
    return sorted(p for p in iterator if p.is_file() and is_music_file(p))


def sort_music(
    source: Path,
    *,
    dry_run: bool,
    copy: bool,
    recursive: bool,
) -> int:
    files = collect_files(source, recursive)
    moved = 0
    skipped = 0
    errors = 0

    for path in files:
        parsed = parse_filename(path)
        if parsed is None:
            print(f"skip (bad name): {path.name}", file=sys.stderr)
            skipped += 1
            continue

        artist, _song = parsed
        artist_dir = source / sanitize_folder_name(artist)
        dest = unique_destination(artist_dir, path.name)

        if path.resolve() == dest.resolve():
            continue

        action = "copy" if copy else "move"
        print(f"{action}: {path} -> {dest}")

        if dry_run:
            moved += 1
            continue

        try:
            artist_dir.mkdir(parents=True, exist_ok=True)
            if copy:
                shutil.copy2(path, dest)
            else:
                shutil.move(path, dest)
            moved += 1
        except OSError as exc:
            print(f"error: {path}: {exc}", file=sys.stderr)
            errors += 1

    print(
        f"\n{'would process' if dry_run else 'processed'}: {moved}, "
        f"skipped: {skipped}, errors: {errors}"
    )
    return 1 if errors else 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sort FLAC/MP3 files into artist folders from "
            "'{artist} - {song}.flac' or '{artist} - {song}.mp3' names."
        )
    )
    parser.add_argument(
        "source",
        nargs="?",
        default=".",
        type=Path,
        help="Directory containing music files (default: current directory)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would happen without moving or copying files",
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="Copy files instead of moving them",
    )
    parser.add_argument(
        "-r",
        "--recursive",
        action="store_true",
        help="Also process music files in subdirectories",
    )
    args = parser.parse_args()
    source = args.source.resolve()

    try:
        return sort_music(
            source,
            dry_run=args.dry_run,
            copy=args.copy,
            recursive=args.recursive,
        )
    except NotADirectoryError as exc:
        print(exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
