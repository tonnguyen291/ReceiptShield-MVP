#!/usr/bin/env bash
# Render docs/architecture/c4/*.puml to SVG via PlantUML JAR, then merge to a single PDF
# Requires: Java 17+, Graphviz (dot), rsvg-convert (librsvg), pdfunite (poppler)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
C4_DIR="$ROOT/docs/architecture/c4"
BUILD_DIR="$C4_DIR/build"
JAR_DIR="$ROOT/tools/plantuml"
JAR="$JAR_DIR/plantuml.jar"
JAR_URL="https://github.com/plantuml/plantuml/releases/download/v1.2024.7/plantuml-1.2024.7.jar"

mkdir -p "$JAR_DIR" "$BUILD_DIR"

if [[ ! -f "$JAR" ]]; then
  echo "Downloading PlantUML JAR to $JAR ..."
  curl -sSL -o "$JAR" "$JAR_URL"
fi

command -v java >/dev/null
command -v dot >/dev/null
command -v rsvg-convert >/dev/null
command -v pdfunite >/dev/null

# Companion PDF: exactly four diagrams (L1 → L2 → intelligence → deployment)
ORDER=(
  "system-context.puml"
  "container-diagram.puml"
  "ml-ai-detailed.puml"
  "deployment-diagram.puml"
)

PDF_PARTS=()
for f in "${ORDER[@]}"; do
  src="$C4_DIR/$f"
  diagram_id="$(awk '/^@startuml /{print $2; exit}' "$src")"
  if [[ -z "$diagram_id" ]]; then
    echo "No @startuml id in $f" >&2
    exit 1
  fi
  echo "==> PlantUML: $f -> ${diagram_id}.svg"
  if ! java -jar "$JAR" -tsvg -o "$BUILD_DIR" "$src"; then
    echo "PlantUML failed for $f" >&2
    exit 1
  fi
  svg="$BUILD_DIR/${diagram_id}.svg"
  pdf="$BUILD_DIR/${diagram_id}.pdf"
  echo "==> rsvg-convert: $svg -> $pdf"
  rsvg-convert -f pdf -o "$pdf" "$svg"
  PDF_PARTS+=("$pdf")
done

OUT="$C4_DIR/RightCall-C4-Companion.pdf"
echo "==> pdfunite -> $OUT"
pdfunite "${PDF_PARTS[@]}" "$OUT"
ls -la "$OUT"
echo "Done."
