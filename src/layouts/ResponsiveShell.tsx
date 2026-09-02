import { useDeviceClass } from '@/hooks/useDeviceClass'
import { MobileLayout } from './MobileLayout'
import { TabletLayout } from './TabletLayout'
import { DesktopLayout } from './DesktopLayout'

// Renders one fully separate layout tree per device class so mobile, tablet,
// and desktop never share cramped/overlapping markup.
export function ResponsiveShell() {
  const deviceClass = useDeviceClass()

  if (deviceClass === 'mobile') return <MobileLayout />
  if (deviceClass === 'tablet') return <TabletLayout />
  return <DesktopLayout />
}
