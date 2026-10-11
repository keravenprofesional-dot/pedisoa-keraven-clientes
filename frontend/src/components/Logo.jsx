import logo from '../assets/logo.jpg'

export default function Logo({ size = 'md' }) {
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
      // mx-auto porque las imágenes son de bloque: sin esto no se centran.
      className={`${heights[size]} w-auto mx-auto rounded-xl object-contain`}
    />
  )
}
