#!/bin/bash
# PRODUCE TODAS LAS IMAGENES DEL CATALOGO KERAVEN.
# Uso: producir.sh [A|B|C]     (por defecto B)
#
# Pasos por producto:
#   1. El arte de imprenta (.eps/.ai) se pasa a PDF con Ghostscript y se dibuja
#      con mutool. Esto es lo que da los colores FIELES (ImageMagick solo
#      invierte varias de estas etiquetas).
#   2. Se recorta la CARA FRONTAL (el pedazo del medio de la etiqueta plana),
#      con la ventana medida para cada familia de etiqueta.
#   3. Se monta en una tarjeta 4:5 sobre crema.
set -u
SP="$(cd "$(dirname "$0")" && pwd)"
SRC="/c/Users/User/OneDrive/Desktop/etiqueta keraven profesional"
CAT="$SP/catalogo"
FIEL="$CAT/fiel"           # etiquetas planas ya renderizadas con color fiel
PAN="$CAT/paneles"         # caras frontales recortadas
OUT="$CAT/final"
EST="${1:-B}"
export PATH="$PATH:/c/Program Files/ImageMagick-7.1.2-Q16:/c/Program Files/gs/gs10.08.0/bin"
mkdir -p "$PAN" "$OUT"

# codigo | archivo de arte (sin .png) | x por mil | ancho por mil | recortar papel blanco (1/0)
TABLA="
SH-COC|KERAVEN_-_SHAMPOO_COCO_32_OZ-01|330|325|0
SH-CAC|KERAVEN_-_SHAMPOO_32_OZ_CACAO|330|325|0
SH-ZAN|KERAVEN_-_SHAMPOO_ZANAHORIA_-_32_OZ|330|325|0
SH-BAN|KERAVEN_-_SHAMPOO_32_OZ_BANANA|330|325|0
SH-JEN|KERAVEN_-_SHAMPOO_JENGIBRE_32_OZ-01|330|325|0
SH-DET|KERAVEN_-_LINEAS_CURATIVAS|330|325|0
TR-BAN|KERAVEN_-_MASCARILLAS_-_32_OZ_BANANA|315|385|0
TR-COC|KERAVEN_-_MASCARILLAS_-_32_OZ_COCO|315|385|0
TR-ZAN|KERAVEN_-_MASCARILLAS_-_32_OZ_ZANAHORIA|315|385|0
TR-JEN|KERAVEN_-_MASCARILLAS_-_32_OZ_JENGOBRE_-_ROMERO_-_CANELA|315|385|0
TR-CAC|KERAVEN_-_TRATAMIENTO|255|450|0
TR-MIE|KERAVEN_-_PROTEINA_DE_LECHE_Y_MIEL-01|270|435|0
SH-GOL|KERAVEN__-_SHAMPOO|295|330|0
BA-GOL|KERAVEN__-_BALSAMO_|295|330|0
LE-8|KERAVEN_-_LEAVE-IN_-_GOLDEN_BLACK|520|440|0
GO-CRE|KERAVEN_-_GOTERO_ACTIVADOR_DEL_CRECIMIENTO-01|450|535|0
GO-ANT|KERAVEN_-_GOTERO_ANTICAIDA|10|440|1
GO-BRI|KERAVEN_GOTA_DE_BRILLO_-_PLOTTER|440|530|1
GR-MOL|KERAVEN_-_GRASITA_MOLDEADORA|300|450|1
GE-INT|KERAVEN_INTIMO-01|325|345|0
CE-MAD|KERAVEN_CELULAS_MADRES_CURVA|330|335|0
CR-NEG|KERAVEN_-_CREMA_NEGRA|355|300|1
CO-BIO|KERAVEN_-_COLAGENO_Y_BIOTINA|325|345|0
"

echo "Estilo: $EST"
echo "$TABLA" | while IFS='|' read -r cod arch x w trim; do
  [ -z "$cod" ] && continue
  # el nombre real en disco puede llevar tildes; buscamos el archivo
  f=$(ls "$FIEL"/*.png 2>/dev/null | sed 's/.*\///' | awk -v a="$arch" '
      { n=$0; gsub(/\.png$/,"",n); t=n;
        gsub(/Ñ/,"N",t); gsub(/Á/,"A",t); gsub(/É/,"E",t); gsub(/Í/,"I",t); gsub(/Ó/,"O",t); gsub(/Ú/,"U",t);
        if (t==a) print n }' | head -1)
  if [ -z "$f" ]; then echo "  FALTA ARTE: $cod ($arch)"; continue; fi
  src="$FIEL/$f.png"
  tmp="$PAN/_tmp.png"
  if [ "$trim" = "1" ]; then magick "$src" -fuzz 3% -trim +repage "$tmp"; else cp "$src" "$tmp"; fi
  IW=$(magick identify -format %w "$tmp"); IH=$(magick identify -format %h "$tmp")
  magick "$tmp" -crop $(( IW*w/1000 ))x${IH}+$(( IW*x/1000 ))+0 +repage "$PAN/$cod.png"
  bash "$SP/tarjeta.sh" "$EST" "$PAN/$cod.png" "$OUT/$cod.jpg"
  printf "  %-8s %6s bytes jpg / %6s bytes webp\n" "$cod" \
    "$(stat -c%s "$OUT/$cod.jpg")" "$(stat -c%s "$OUT/$cod.webp")"
done
rm -f "$PAN/_tmp.png"
echo "Listo en: $OUT"
