# Arte de los productos Keraven

## Qué hay aquí

- **imagenes/** — 27 productos listos para el catálogo, en `.webp` (lo que se usa) y
  `.jpg` (respaldo por si un teléfono viejo no abre webp). Las 27 en webp pesan
  276 KB en total: unos 10 KB cada una, 1.7 segundos por producto a 6 KB/s.
- **recetas/** — los guiones que las producen, y `mapa_producto_imagen.csv` con
  qué producto corresponde a qué archivo de arte.
- **HOJA-DE-CONTACTOS-27-productos.jpg** — todas juntas, para verlas de un golpe.
- **COMPARACION-A-B-C.jpg** — tres estilos de tarjeta; está aplicado el **B**.

## De dónde salen

Del arte de imprenta del diseñador, que vive en el escritorio del dueño:
`Desktop\etiqueta keraven profesional` (74 archivos, 1.1 GB). **Esa carpeta no se
toca: es el original.** De cada etiqueta se recorta solo la **cara frontal** —
el bloque del medio, que es lo que identifica el producto— y se monta centrada
en un recuadro 4:5 con fondo crema, igual para todos, para que una etiqueta alta
(shampoo) y una baja (grasita) se vean como una familia.

## OJO con la conversión

Convertir el .eps directo con ImageMagick **invierte los colores** en la mitad de
las etiquetas: el cacao sale morado, la zanahoria azul. El camino correcto, que
es el que usan estos guiones, es:

    .eps/.ai  →  Ghostscript (lo pasa a PDF)  →  mutool (lo dibuja)  →  PNG

Hace falta ImageMagick, Ghostscript y mutool instalados.

## Lo que falta

Sin arte (hay que pedírselo al diseñador o quitar del catálogo):
- Tratamiento Detox Negro 32 oz y 10 oz
- Mascarilla de Rizos 16 oz

Con arte pero sin estar en el catálogo (falta ponerles precio y decidir):
- Gotero Anticaída 4 oz
- Crema Negra 33.8 oz
- Shampoo Colágeno y Biotina 22 oz

Confirmado por el dueño: **Células Madres y Cirugía Capilar son el mismo producto**
(la etiqueta dice las dos cosas). En el catálogo está como CI-CAP-1 y CI-CAP-16.
