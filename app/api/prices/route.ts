import { NextResponse } from 'next/server'
import { fetchMarketData, computeSignals } from '@/lib/prices'

export async function GET() {
  try {
    const snapshot = await fetchMarketData()
    const signals = computeSignals(snapshot.prices)
    return NextResponse.json({ success: true, snapshot, signals })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
