import { useEffect, useState } from 'react'

export type DeviceClass = 'mobile' | 'tablet' | 'desktop'

// Separate breakpoints on purpose: each device class renders its OWN layout
// component tree (not a CSS-only responsive hack) so nothing overlaps or
// squeezes between form factors — per project requirement.
const MOBILE_MAX = 767
const TABLET_MAX = 1180

function computeClass(width: number): DeviceClass {
  if (width <= MOBILE_MAX) return 'mobile'
  if (width <= TABLET_MAX) return 'tablet'
  return 'desktop'
}

export function useDeviceClass(): DeviceClass {
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(() =>
    typeof window === 'undefined' ? 'desktop' : computeClass(window.innerWidth)
  )

  useEffect(() => {
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setDeviceClass(computeClass(window.innerWidth)))
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frame)
    }
  }, [])

  return deviceClass
}
