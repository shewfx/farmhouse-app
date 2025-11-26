'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../utils/supabaseClient'

export default function InspectionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('id')

  const [status, setStatus] = useState('CLEAN')
  const [photoUrl, setPhotoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  if (!bookingId) return <div className="p-10">Error: No Booking ID found.</div>

  async function handleSubmit() {
    setLoading(true)
    setMsg('')

    const userId = localStorage.getItem('farmhouse_user_id')

    // 1. Save Report
    const { error } = await supabase.from('inspections').insert([
      {
        booking_id: bookingId,
        inspector_id: userId,
        is_clean: status === 'CLEAN',
        evidence_photo_url: photoUrl,
        comments: status === 'DIRTY' ? 'Reported previous guest.' : 'All good.'
      }
    ])

    if (error) {
      setMsg('Error saving report.')
      setLoading(false)
      return
    }

    // 2. SNITCH LOGIC
    if (status === 'DIRTY') {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: previousBookings } = await supabase
        .from('bookings')
        .select('family_id, families(name, base_priority_score)')
        .lt('end_date', today)
        .order('end_date', { ascending: false })
        .limit(1)

      if (previousBookings && previousBookings.length > 0) {
        // FIX: We cast this to 'any' to stop TypeScript from complaining about the 'families' array/object mismatch
        const culprit: any = previousBookings[0]
        
        const penalty = 5 
        
        // Now TypeScript won't complain about .families.base_priority_score
        const newScore = culprit.families.base_priority_score - penalty

        await supabase
          .from('families')
          .update({ base_priority_score: newScore })
          .eq('id', culprit.family_id)

        setMsg(`🚨 REPORT FILED! The ${culprit.families.name} family was fined ${penalty} points.`)
      } else {
        setMsg('Report filed, but no previous recent guest found to penalize.')
      }
    } else {
      setMsg('✅ Check-in Complete! Enjoy your stay.')
    }

    setTimeout(() => router.push('/dashboard'), 3000)
  }

  return (
    <div className="min-h-screen bg-red-50 p-6 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border-t-8 border-red-600">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">👮 Farmhouse Check-In</h1>
        <p className="text-gray-600 mb-6">Verify the condition of the house.</p>

        <div className="space-y-6">
          <div>
            <label className="block text-lg font-bold text-gray-800 mb-3">Is the house clean?</label>
            <div className="flex gap-4">
              <button onClick={() => setStatus('CLEAN')} className={`flex-1 p-4 rounded-lg border-2 font-bold ${status === 'CLEAN' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400'}`}>Yes, Clean ✨</button>
              <button onClick={() => setStatus('DIRTY')} className={`flex-1 p-4 rounded-lg border-2 font-bold ${status === 'DIRTY' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-400'}`}>No, Messy 😡</button>
            </div>
          </div>

          {status === 'DIRTY' && (
            <div>
              <label className="block text-sm font-bold text-red-800 mb-1">Upload Proof</label>
              <input type="text" placeholder="Paste photo URL here..." className="w-full p-3 border border-red-300 rounded-md" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} />
            </div>
          )}

          {msg && <div className="p-3 bg-gray-100 rounded text-center font-bold text-gray-800">{msg}</div>}

          <button onClick={handleSubmit} disabled={loading || (status === 'DIRTY' && !photoUrl)} className="w-full py-4 bg-gray-900 text-white font-bold rounded-lg hover:bg-black disabled:opacity-50">
            {loading ? 'Processing...' : status === 'DIRTY' ? 'Report & Penalize' : 'Confirm Check-in'}
          </button>
        </div>
      </div>
    </div>
  )
}