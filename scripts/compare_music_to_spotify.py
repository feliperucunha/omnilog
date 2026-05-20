#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

MUSIC_SUFFIXES = frozenset({".flac", ".mp3"})
SEPARATOR = " - "
ARTIST_SPLIT = re.compile(r"[;,/&]| feat\.| ft\.| featuring ", re.IGNORECASE)
PAREN_SUFFIX = re.compile(
    r"\s*[\(\[][^\)\]]*[\)\]]\s*",
    re.IGNORECASE,
)
REMASTER_SUFFIX = re.compile(
    r"\s*-\s*(re-?recorded|re-?master(ed)?(\s+\d{4})?|radio edit|live|acoustic|"
    r"unplugged|demo|instrumental|remix|edit|version)\s*$",
    re.IGNORECASE,
)
FEAT_IN_TITLE = re.compile(
    r"\s*[\(\[](feat\.?|ft\.?|featuring)[^\)\]]*[\)\]]\s*",
    re.IGNORECASE,
)
NON_ALNUM = re.compile(r"[^a-z0-9\s]")
WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class Track:
    artist: str
    title: str
    source: str
    path: str = ""
    album: str = ""
    row_index: int = 0

    @property
    def label(self) -> str:
        return f"{self.artist} - {self.title}"


@dataclass(frozen=True)
class MatchCandidate:
    local: Track
    spotify: Track
    score: float
    title_score: float
    artist_score: float


def is_music_file(path: Path) -> bool:
    return path.suffix.lower() in MUSIC_SUFFIXES


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = text.replace("’", "'").replace("`", "'")
    text = NON_ALNUM.sub(" ", text)
    text = WHITESPACE.sub(" ", text).strip()
    return text


def normalize_title(title: str) -> str:
    text = title
    text = FEAT_IN_TITLE.sub(" ", text)
    while True:
        updated = PAREN_SUFFIX.sub(" ", text)
        if updated == text:
            break
        text = updated
    text = REMASTER_SUFFIX.sub("", text)
    return normalize_text(text)


def artist_tokens(artist_field: str) -> list[str]:
    tokens: list[str] = []
    for part in ARTIST_SPLIT.split(artist_field):
        normalized = normalize_text(part)
        if normalized:
            tokens.append(normalized)
    return tokens or [normalize_text(artist_field)]


def title_similarity(left: str, right: str) -> float:
    a = normalize_title(left)
    b = normalize_title(right)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        shorter = min(len(a), len(b))
        longer = max(len(a), len(b))
        if shorter / longer >= 0.6:
            return 0.95
    return SequenceMatcher(None, a, b).ratio()


def artist_similarity(left: str, right: str) -> float:
    left_tokens = artist_tokens(left)
    right_tokens = artist_tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0

    best = 0.0
    for a in left_tokens:
        for b in right_tokens:
            if a == b:
                return 1.0
            if a in b or b in a:
                shorter = min(len(a), len(b))
                longer = max(len(a), len(b))
                if shorter / longer >= 0.5:
                    best = max(best, 0.92)
                    continue
            best = max(best, SequenceMatcher(None, a, b).ratio())
    return best


def match_score(local: Track, spotify: Track) -> MatchCandidate:
    title_score = title_similarity(local.title, spotify.title)
    artist_score = artist_similarity(local.artist, spotify.artist)
    score = (title_score * 0.72) + (artist_score * 0.28)
    if title_score >= 0.97 and artist_score >= 0.55:
        score = max(score, 0.9)
    if title_score >= 0.9 and artist_score >= 0.85:
        score = max(score, 0.95)
    return MatchCandidate(local, spotify, score, title_score, artist_score)


def parse_local_file(path: Path, music_root: Path) -> Track | None:
    stem = path.stem
    artist = ""
    title = ""

    if SEPARATOR in stem:
        artist, title = stem.split(SEPARATOR, 1)
    elif path.parent != music_root:
        artist = path.parent.name
        title = stem
    else:
        return None

    artist = artist.strip()
    title = title.strip()
    if not artist or not title:
        return None

    return Track(
        artist=artist,
        title=title,
        source="local",
        path=str(path.resolve()),
    )


def collect_local_tracks(music_dir: Path, recursive: bool) -> tuple[list[Track], list[Path]]:
    if not music_dir.is_dir():
        raise NotADirectoryError(f"Not a directory: {music_dir}")

    iterator = music_dir.rglob("*") if recursive else music_dir.iterdir()
    unparseable: list[Path] = []
    tracks: list[Track] = []

    for path in sorted(p for p in iterator if p.is_file() and is_music_file(p)):
        parsed = parse_local_file(path, music_dir)
        if parsed is None:
            unparseable.append(path)
            continue
        tracks.append(parsed)

    return tracks, unparseable


def load_spotify_csv(csv_path: Path) -> list[Track]:
    tracks: list[Track] = []
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"Track Name", "Artist Name(s)"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            missing = ", ".join(sorted(required))
            raise ValueError(f"CSV must include columns: {missing}")

        for index, row in enumerate(reader, start=2):
            title = (row.get("Track Name") or "").strip()
            artist = (row.get("Artist Name(s)") or "").strip()
            album = (row.get("Album Name") or "").strip()
            if not title or not artist:
                continue
            tracks.append(
                Track(
                    artist=artist,
                    title=title,
                    source="spotify",
                    album=album,
                    row_index=index,
                )
            )
    return tracks


def greedy_match(
    local_tracks: list[Track],
    spotify_tracks: list[Track],
    threshold: float,
) -> tuple[list[MatchCandidate], list[Track], list[Track]]:
    candidates: list[MatchCandidate] = []
    for local in local_tracks:
        for spotify in spotify_tracks:
            candidate = match_score(local, spotify)
            if candidate.score >= threshold * 0.75:
                candidates.append(candidate)

    candidates.sort(key=lambda item: item.score, reverse=True)
    used_local: set[int] = set()
    used_spotify: set[int] = set()
    matches: list[MatchCandidate] = []

    local_ids = {id(track): track for track in local_tracks}
    spotify_ids = {id(track): track for track in spotify_tracks}

    for candidate in candidates:
        local_key = id(candidate.local)
        spotify_key = id(candidate.spotify)
        if local_key in used_local or spotify_key in used_spotify:
            continue
        if candidate.score < threshold:
            continue
        used_local.add(local_key)
        used_spotify.add(spotify_key)
        matches.append(candidate)

    unmatched_local = [track for track in local_tracks if id(track) not in used_local]
    unmatched_spotify = [track for track in spotify_tracks if id(track) not in used_spotify]
    return matches, unmatched_local, unmatched_spotify


def write_report(
    output_path: Path,
    matches: list[MatchCandidate],
    only_local: list[Track],
    only_spotify: list[Track],
    unparseable: list[Path],
) -> None:
    fieldnames = [
        "status",
        "match_score",
        "title_score",
        "artist_score",
        "local_artist",
        "local_title",
        "local_path",
        "spotify_artist",
        "spotify_title",
        "spotify_album",
        "spotify_csv_row",
        "notes",
    ]

    rows: list[dict[str, str]] = []

    for match in sorted(matches, key=lambda item: item.score, reverse=True):
        rows.append(
            {
                "status": "matched",
                "match_score": f"{match.score:.3f}",
                "title_score": f"{match.title_score:.3f}",
                "artist_score": f"{match.artist_score:.3f}",
                "local_artist": match.local.artist,
                "local_title": match.local.title,
                "local_path": match.local.path,
                "spotify_artist": match.spotify.artist,
                "spotify_title": match.spotify.title,
                "spotify_album": match.spotify.album,
                "spotify_csv_row": str(match.spotify.row_index),
                "notes": "",
            }
        )

    for track in sorted(only_local, key=lambda item: item.label.lower()):
        rows.append(
            {
                "status": "missing_from_spotify",
                "match_score": "",
                "title_score": "",
                "artist_score": "",
                "local_artist": track.artist,
                "local_title": track.title,
                "local_path": track.path,
                "spotify_artist": "",
                "spotify_title": "",
                "spotify_album": "",
                "spotify_csv_row": "",
                "notes": "In music folder but no close match in Spotify CSV",
            }
        )

    for track in sorted(only_spotify, key=lambda item: item.label.lower()):
        rows.append(
            {
                "status": "missing_from_folder",
                "match_score": "",
                "title_score": "",
                "artist_score": "",
                "local_artist": "",
                "local_title": "",
                "local_path": "",
                "spotify_artist": track.artist,
                "spotify_title": track.title,
                "spotify_album": track.album,
                "spotify_csv_row": str(track.row_index),
                "notes": "In Spotify CSV but no close match in music folder",
            }
        )

    for path in unparseable:
        rows.append(
            {
                "status": "unparseable_file",
                "match_score": "",
                "title_score": "",
                "artist_score": "",
                "local_artist": "",
                "local_title": "",
                "local_path": str(path.resolve()),
                "spotify_artist": "",
                "spotify_title": "",
                "spotify_album": "",
                "spotify_csv_row": "",
                "notes": "Expected '{artist} - {song}' or files inside artist folders",
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def compare(
    music_dir: Path,
    spotify_csv: Path,
    output_csv: Path,
    *,
    recursive: bool,
    threshold: float,
) -> int:
    local_tracks, unparseable = collect_local_tracks(music_dir, recursive)
    spotify_tracks = load_spotify_csv(spotify_csv)
    matches, only_local, only_spotify = greedy_match(
        local_tracks, spotify_tracks, threshold
    )
    write_report(output_csv, matches, only_local, only_spotify, unparseable)

    print(f"Local tracks: {len(local_tracks)}")
    print(f"Spotify tracks: {len(spotify_tracks)}")
    print(f"Matched: {len(matches)}")
    print(f"Missing from Spotify CSV: {len(only_local)}")
    print(f"Missing from music folder: {len(only_spotify)}")
    print(f"Unparseable files: {len(unparseable)}")
    print(f"Report written to: {output_csv.resolve()}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Compare a folder of FLAC/MP3 files against a Spotify playlist CSV export "
            "and write a report of matches and mismatches both ways."
        )
    )
    parser.add_argument(
        "music_dir",
        type=Path,
        help="Folder containing music files (flat or sorted by artist subfolders)",
    )
    parser.add_argument(
        "spotify_csv",
        type=Path,
        help="Spotify export CSV (must include Track Name and Artist Name(s))",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("music_comparison_report.csv"),
        help="Output CSV path (default: music_comparison_report.csv)",
    )
    parser.add_argument(
        "-r",
        "--recursive",
        action="store_true",
        help="Search for music files in subdirectories",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.82,
        help="Match confidence threshold from 0 to 1 (default: 0.82)",
    )
    args = parser.parse_args()

    if not 0.5 <= args.threshold <= 1.0:
        print("threshold must be between 0.5 and 1.0", file=sys.stderr)
        return 1
    if not args.spotify_csv.is_file():
        print(f"CSV not found: {args.spotify_csv}", file=sys.stderr)
        return 1

    try:
        return compare(
            args.music_dir.resolve(),
            args.spotify_csv.resolve(),
            args.output.resolve(),
            recursive=args.recursive,
            threshold=args.threshold,
        )
    except (NotADirectoryError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
