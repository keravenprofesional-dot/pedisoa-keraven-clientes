import logo from '../assets/logo.jpg'

// `centrado` existe porque las imágenes son de bloque: sin mx-auto se
// quedan a la izquierda, por mucho que el texto alrededor esté centrado.
export default function Logo({ size = 'md', centrado = true }) {
  const heights = {
    sm: 'h-10',
    md: 'h-16',
    lg: 'h-24',
    xl: 'h-36',
  }
  return (
    <img
      src={logo}
      alt="Keraven Profesional"
      className={`${heights[size]} w-auto ${centrado ? 'mx-auto' : ''} rounded-xl object-contain`}
    />
  )
}
