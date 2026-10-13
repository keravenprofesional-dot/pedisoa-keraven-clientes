#!/bin/bash
# Productos cuya etiqueta SOLO existe dentro de un pliego de imprenta (MONTAJE).
# Un pliego trae la etiqueta repetida muchas veces y con marcas de corte, asi que
# aqui recortamos UNA sola copia limpia, por coordenadas medidas a mano.
# Uso: producir_pliegos.sh [A|B|C]
set -u
SP="$(cd "$(dirname "$0")" && pwd)"
SRC="/c/Users/User/OneDrive/Desktop/etiqueta keraven profesional"
CAT="$SP/catalogo"; PAN="$CAT/paneles"; OUT="$CAT/final"; W="$CAT/work"
EST="${1:-B}"
export PATH="$PATH:/c/Program Files/ImageMagick-7.1.2-Q16"
MUTOOL="/c/Users/User/AppData/Local/Microsoft/WinGet/Packages/ArtifexSoftware.mutool_Microsoft.Winget.Source_8wekyb3d8bbwe/mupdf-1.23.0-windows/mutool.exe"
mkdir -p "$PAN" "$OUT" "$W/mont"

# Los pliegos se dibujan a 110 puntos por pulgada: asi las coordenadas de abajo cuadran.
[ -f "$W/mont/rizos.png" ] || "$MUTOOL" draw -o "$W/mont/rizos.png" -r 110 "$SRC/MONTAJE KERAVEN .pdf" 1 >/dev/null 2>&1
[ -f "$W/mont/metal.png" ] || "$MUTOOL" draw -o "$W/mont/metal.png" -r 110 "$SRC/MONTAJE KERAVEN METALIZADO.pdf" 1 >/dev/null 2>&1

# codigo | pliego | recorte AnchoxAlto+X+Y | giro en grados
TABLA="
SH-RIZ|rizos|250x478+1485+5|0
ES-RIZ|rizos|250x478+1485+500|0
SP-RIZ|rizos|479x195+1442+1230|90
LA-8|metal|400x470+1255+950|0
"
echo "$TABLA" | while IFS='|' read -r cod pl rec giro; do
  [ -z "$cod" ] && continue
  magick "$W/mont/$pl.png" -crop "$rec" +repage -rotate "$giro" "$PAN/$cod.png"
  bash "$SP/tarjeta.sh" "$EST" "$PAN/$cod.png" "$OUT/$cod.jpg"
  printf "  %-8s %6s bytes jpg / %6s bytes webp\n" "$cod" \
    "$(stat -c%s "$OUT/$cod.jpg")" "$(stat -c%s "$OUT/$cod.webp")"
done
