export interface TestCard {
  readonly id: 'approved' | 'declined' | 'insufficient_funds'
  readonly label: string
  readonly number: string
  readonly outcome: 'approved' | 'declined'
  readonly declineReason?: string
}

export const testCards: readonly TestCard[] = [
  { id: 'approved', label: 'Approved', number: '4242424242424242', outcome: 'approved' },
  {
    id: 'declined',
    label: 'Declined',
    number: '4000000000000002',
    outcome: 'declined',
    declineReason: 'Your card was declined',
  },
  {
    id: 'insufficient_funds',
    label: 'Insufficient funds',
    number: '4000000000009995',
    outcome: 'declined',
    declineReason: 'Your card has insufficient funds',
  },
]

export const approvedTestCard: TestCard = testCards[0]!

export function findTestCard(id: string): TestCard | undefined {
  return testCards.find((card) => card.id === id)
}
