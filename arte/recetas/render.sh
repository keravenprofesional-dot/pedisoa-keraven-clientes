#!/bin/bash
# Convierte un .eps o .ai de Illustrator a PNG con los colores FIELES.
# Por que asi: ImageMagick solo invierte los colores de varias de estas etiquetas
# (el cacao salia morado, la zanahoria azul). Pasando primero por PDF con
# Ghostscript y dibujando despues con mutool, los colores salen como en imprenta.
export PATH="$PATH:/c/Program Files/ImageMagick-7.1.2-Q16:/c/Program Files/gs/gs10.08.0/bin"
MUTOOL="/c/Users/User/AppData/Local/Microsoft/WinGet/Packages/ArtifexSoftware.mutool_Microsoft.Winget.Source_8wekyb3d8bbwe/mupdf-1.23.0-windows/mutool.exe"
IN="$1"; OUT="$2"; RES="${3:-150}"
TMP=$(mktemp -u).pdf
gswin64c -q -dNOPAUSE -dBATCH -dSAFER -dEPSCrop -sDEVICE=pdfwrite -sOutputFile="$TMP" "$IN" 2>/dev/null
"$MUTOOL" draw -o "$OUT" -r "$RES" "$TMP" 1 >/dev/null 2>&1
rm -f "$TMP"
