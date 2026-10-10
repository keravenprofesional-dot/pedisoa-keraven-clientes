import logo from '../assets/logo.jpg'

export default function Logo({ size = 'md' }) {
  const heights = {
    sm: 'h-8',
    md: 'h-14',
    lg: 'h-20',
  }
  return (
    <img
      src={logo}
      alt="Keraven Profesional"
      className={`${heights[size]} w-auto rounded-lg object-contain`}
    />
  )
}
