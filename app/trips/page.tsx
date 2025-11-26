'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../utils/supabaseClient'

export default function TripsPage() {
  const router = useRouter()
  const [allBookings, setAllBookings] = useState<any[]>([])
  const [myFamilyId, setMyFamilyId] = useState<string | null>(null)

  useEffect(() => {
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
    getData()
  }, [])

  function handleChallenge(booking: any) {
    // Redirect to booking page with these dates pre-filled
    // This triggers the existing "Battle Logic" in the booking form
    router.push(`/booking?date=${booking.start_date}&endDate=${booking.end_date}`)
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