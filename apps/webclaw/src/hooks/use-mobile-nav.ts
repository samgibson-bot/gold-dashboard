import { create } from 'zustand'

type MobileNavState = {
  isOpen: boolean
}

export const useMobileNav = create<MobileNavState>(() => ({ isOpen: false }))

export function openMobileNav() {
  useMobileNav.setState({ isOpen: true })
}

export function closeMobileNav() {
  useMobileNav.setState({ isOpen: false })
}
