#!/bin/bash
# Monta la cara frontal de un producto en una tarjeta 4:5 lista para el catalogo.
# Uso: tarjeta.sh ESTILO panel.png salida.jpg
#
# La cara frontal se mete DENTRO de una caja fija (310x432 px). Asi una etiqueta
# alta (shampoo) y una ancha (grasita) quedan con el mismo aire alrededor y
# todas las tarjetas se ven de la misma familia.
export PATH="$PATH:/c/Program Files/ImageMagick-7.1.2-Q16"
EST="$1"; P="$2"; O="$3"
TW=400; TH=500               # 4:5
CAJA="330x432"               # hueco donde entra la etiqueta
CAJAC="282x392"              # hueco mas chico para el estilo editorial
CREMA="#FBF6EA"; CREMAOSC="#F3EADA"; ORO="#D4A431"
T=$(mktemp -d)

case "$EST" in
A) # Etiqueta limpia: la cara frontal flotando sobre crema, con sombra suave.
   magick "$P" -resize "$CAJA" "$T/p.png"
   magick "$T/p.png" \( +clone -background black -shadow 38x9+0+7 \) +swap \
     -background none -layers merge +repage "$T/s.png"
   magick -size ${TW}x${TH} xc:"$CREMA" "$T/s.png" -gravity center -geometry +0-5 -composite "$T/out.png"
   ;;
B) # Frasco simulado: luz de cilindro y bordes curvos; se lee como pote, no como papel.
   magick "$P" -resize "$CAJA" "$T/p.png"
   W=$(magick identify -format %w "$T/p.png"); H=$(magick identify -format %h "$T/p.png")
   # BOW = cuanto se arquean el borde de arriba y el de abajo.
   # Va con el ancho (mientras mas ancha la etiqueta, mas redondo el pote),
   # pero nunca mas de 1/6 del alto: si no, una etiqueta baja y ancha
   # (la grasita) queda con forma de pastilla en vez de pote.
   HW=$((W/2)); BOW=$((W/9)); TOPE=$((H/6))
   [ $BOW -gt $TOPE ] && BOW=$TOPE
   [ $BOW -lt 4 ] && BOW=4
   magick -size ${H}x${HW} gradient:'#9a9a9a'-'#ffffff' -rotate 90 "$T/l1.png"
   magick "$T/l1.png" \( +clone -flop \) +append -resize ${W}x${H}! "$T/l2.png"
   magick "$T/p.png" "$T/l2.png" -compose Multiply -composite "$T/luz.png"
   magick -size ${W}x${H} xc:black -fill white \
     -draw "rectangle 0,${BOW} $((W-1)),$((H-BOW))" \
     -draw "ellipse $((W/2)),${BOW} $((W/2)),${BOW} 0,360" \
     -draw "ellipse $((W/2)),$((H-BOW)) $((W/2)),${BOW} 0,360" -blur 0x0.6 "$T/m.png"
   magick "$T/luz.png" "$T/m.png" -alpha off -compose CopyOpacity -composite "$T/f.png"
   magick "$T/f.png" \( +clone -background black -shadow 42x10+0+9 \) +swap \
     -background none -layers merge +repage "$T/s.png"
   magick -size ${TW}x${TH} xc:"$CREMA" "$T/s.png" -gravity center -geometry +0-3 -composite "$T/out.png"
   ;;
C) # Editorial: mas aire, degradado de dos cremas y un hilo de oro. Lujo = vacio ordenado.
   magick "$P" -resize "$CAJAC" "$T/p.png"
   magick -size ${TW}x${TH} gradient:"$CREMA"-"$CREMAOSC" \
     -fill none -stroke "$ORO" -strokewidth 1 -draw "rectangle 15,15 $((TW-16)),$((TH-16))" "$T/bg.png"
   magick "$T/p.png" \( +clone -background black -shadow 32x8+0+6 \) +swap \
     -background none -layers merge +repage "$T/s.png"
   magick "$T/bg.png" "$T/s.png" -gravity center -geometry +0-10 -composite "$T/out.png"
   ;;
esac

magick "$T/out.png" -quality 78 -sampling-factor 4:2:0 -strip "$O"
magick "$T/out.png" -quality 72 -define webp:method=6 -strip "${O%.jpg}.webp"
rm -rf "$T"
