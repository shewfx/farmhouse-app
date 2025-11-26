'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../utils/supabaseClient'

export default function TripsPage() {
  const router = useRouter()
  const [allBookings, setAllBookings] = useState<any[]>([])
  const [myFamilyId, setMyFamilyId] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    getData()
  }, [])

  async function getData() {
    const fId = localStorage.getItem('farmhouse_family_id')
    setMyFamilyId(fId)

    const today = new Date().toISOString().split('T')[0]
    
    // Fetch ALL bookings for everyone
    const { data } = await supabase
      .from('bookings')
      .select('*, families(name, base_priority_score)')
      .gte('end_date', today)
      .neq('status', 'CANCELLED')
      .order('start_date', { ascending: true })

    if (data) setAllBookings(data)
  }

  function handleChallenge(booking: any) {
    router.push(`/booking?date=${booking.start_date}&endDate=${booking.end_date}`)
  }

  // === CANCELLATION LOGIC ===
  async function handleCancel(booking: any) {
    if (!confirm('Are you sure you want to cancel this trip?')) return
    setCancelLoading(true)

    const familyId = localStorage.getItem('farmhouse_family_id')
    
    // 1. GRACE PERIOD CHECK (1 Hour)
    const createdAt = new Date(booking.created_at).getTime()
    const now = new Date().getTime()
    const hoursSinceBooking = (now - createdAt) / (1000 * 60 * 60)

    let penalty = 0
    let penaltyMsg = "Free Cancellation"

    if (hoursSinceBooking > 1) {
        // 2. STANDARD PENALTY CHECK
        const start = new Date(booking.start_date)
        const today = new Date()
        start.setHours(0,0,0,0)
        today.setHours(0,0,0,0)

        const diffTime = start.getTime() - today.getTime()
        const daysBefore = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (daysBefore <= 1) { 
            penalty = 15
            penaltyMsg = "Late Cancellation (1 Day before)"
        } else if (daysBefore <= 2) {
            penalty = 8
            penaltyMsg = "Late Cancellation (2 Days before)"
        } else if (daysBefore <= 3) {
            penalty = 5
            penaltyMsg = "Late Cancellation (3 Days before)"
        }
    } else {
        penaltyMsg = "Free - Grace Period"
    }

    // Apply Penalty
    if (penalty > 0) {
      const { data: familyData } = await supabase
        .from('families')
        .select('base_priority_score')
        .eq('id', familyId)
        .single()
      
      if (familyData) {
          const newScore = familyData.base_priority_score - penalty
          await supabase.from('families').update({ base_priority_score: newScore }).eq('id', familyId)
      }
    }

    // Update Status
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('id', booking.id)

    if (error) {
      alert('Error cancelling booking.')
    } else {
      alert(penalty > 0 
        ? `⚠️ Booking Cancelled. Penalty: -${penalty} pts (${penaltyMsg})` 
        : `✅ Booking Cancelled (${penaltyMsg})`)
      
      getData() // Refresh list
    }
    setCancelLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🏡 All Upcoming Trips</h1>
          <button onClick={() => router.push('/dashboard')} className="bg-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm border border-gray-200 hover:bg-gray-50">
            &larr; Back
          </button>
        </div>

        <div className="space-y-4">
          {allBookings.map(booking => {
            const isMyFamily = String(booking.family_id) === myFamilyId
            const isPending = booking.status === 'PENDING'

            return (
              <div key={booking.id} className={`p-5 rounded-xl border-2 flex justify-between items-center bg-white ${isPending ? 'border-yellow-400' : 'border-transparent shadow-sm'}`}>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    {booking.families?.name} 
                    {isMyFamily && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">You</span>}
                  </h3>
                  <p className="text-gray-600">
                    {new Date(booking.start_date).toLocaleDateString()} — {new Date(booking.end_date).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded font-bold ${booking.booking_type === 'FAMILY' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                      {booking.booking_type}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-bold ${isPending ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {booking.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                    {/* CHALLENGE BUTTON: Show if it's PENDING and NOT my family */}
                    {isPending && !isMyFamily && (
                    <button 
                        onClick={() => handleChallenge(booking)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-red-700 hover:scale-105 transition-all text-sm flex flex-col items-center"
                    >
                        <span>⚔️ Challenge</span>
                        <span className="text-[10px] font-normal opacity-90">Steal Booking</span>
                    </button>
                    )}

                    {/* CANCEL BUTTON: Show if it IS my family */}
                    {isMyFamily && (
                        <button 
                            onClick={() => handleCancel(booking)}
                            disabled={cancelLoading}
                            className="bg-red-50 border border-red-500 text-red-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <span>🗑️</span> Cancel
                        </button>
                    )}
                </div>
              </div>
            )
          })}

          {allBookings.length === 0 && (
            <div className="text-center text-gray-500 py-10">No upcoming trips found.</div>
          )}
        </div>
      </div>
    </div>
  )
}