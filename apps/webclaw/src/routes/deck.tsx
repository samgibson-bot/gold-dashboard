import { createFileRoute } from '@tanstack/react-router'
import { DeckScreen } from '../screens/deck/deck-screen'

export const Route = createFileRoute('/deck')({
  component: DeckScreen,
})
