'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../utils/supabaseClient'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [family, setFamily] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const userId = localStorage.getItem('farmhouse_user_id')
    const familyId = localStorage.getItem('farmhouse_family_id')

    if (!userId || !familyId) {
      router.push('/login')
      return
    }

    const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single()
    setUser(userData)

    const { data: familyData } = await supabase.from('families').select('*').eq('id', familyId).single()
    setFamily(familyData)

    const today = new Date().toISOString().split('T')[0]
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*, inspections(id)')
      .eq('user_id', userId)
      .gte('end_date', today)
      .neq('status', 'CANCELLED')
      .order('start_date', { ascending: true })
    
    // === LAZY RESOLUTION: Check for Expired Pending Windows ===
    if (bookingData) {
      const now = new Date().getTime()
      const updatedBookings = [...bookingData]
      let needsRefresh = false

      for (let i = 0; i < updatedBookings.length; i++) {
        const booking = updatedBookings[i]
        
        if (booking.status === 'PENDING') {
          const createdTime = new Date(booking.created_at).getTime()
          const hoursDiff = (now - createdTime) / (1000 * 60 * 60)
          
          // NEW: Check if the Trip Start Date has already arrived
          // (This fixes the "Book for Tomorrow" loophole)
          const tripStartTime = new Date(booking.start_date).getTime()
          const hasTripStarted = now >= tripStartTime

          // Confirm if 48 hours have passed OR if the trip has started
          if (hoursDiff >= 48 || hasTripStarted) {
            await supabase.from('bookings').update({ status: 'CONFIRMED' }).eq('id', booking.id)
            
            const start = new Date(booking.start_date)
            const end = new Date(booking.end_date)
            start.setHours(0,0,0,0); end.setHours(0,0,0,0)
            const diffTime = Math.abs(end.getTime() - start.getTime())
            const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            const rate = booking.booking_type === 'FAMILY' ? 5 : 8
            const cost = durationDays * rate

            const { data: currentFam } = await supabase.from('families').select('base_priority_score').eq('id', familyId).single()
            if (currentFam) {
               const newScore = currentFam.base_priority_score - cost
               await supabase.from('families').update({ base_priority_score: newScore }).eq('id', familyId)
            }

            booking.status = 'CONFIRMED'
            needsRefresh = true
          }
        }
      }
      
      setBookings(updatedBookings)
      if (needsRefresh) {
         const { data: freshFam } = await supabase.from('families').select('*').eq('id', familyId).single()
         setFamily(freshFam)
      }
    }

    // === FETCH NOTIFICATIONS ===
    const { data: notifData } = await supabase
      .from('notifications')
      .select('*')
      .eq('family_id', familyId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
    
    if (notifData) setNotifications(notifData)

    setLoading(false)
  }

  function handleLogout() {
    localStorage.clear()
    router.push('/login')
  }

  async function handleDismiss(notifId: any) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId)
    setNotifications(prev => prev.filter(n => n.id !== notifId))
  }

  async function handleCancel(booking: any) {
    if (!confirm('Are you sure you want to cancel this trip?')) return
    setCancelLoading(true)
    const familyId = localStorage.getItem('farmhouse_family_id')
    const start = new Date(booking.start_date); const today = new Date(); start.setHours(0,0,0,0); today.setHours(0,0,0,0)
    const diffTime = start.getTime() - today.getTime(); const daysBefore = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    let penalty = 0
    if (daysBefore <= 1) penalty = 15
    else if (daysBefore <= 2) penalty = 8
    else if (daysBefore <= 3) penalty = 5

    if (penalty > 0) {
      const { data: familyData } = await supabase.from('families').select('base_priority_score').eq('id', familyId).single()
      const newScore = (familyData?.base_priority_score || 0) - penalty
      await supabase.from('families').update({ base_priority_score: newScore }).eq('id', familyId)
    }

    const { error } = await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', booking.id)
    if (!error) {
      alert(penalty > 0 ? `⚠️ Cancelled. Penalty: -${penalty} pts` : '✅ Cancelled (No Penalty)')
      loadDashboard()
    }
    setCancelLoading(false)
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome, {user?.full_name}</h1>
          <p className="text-gray-600">Representing: <span className="font-semibold">{family?.name}</span></p>
        </div>
        <button onClick={handleLogout} className="text-sm text-red-600 font-medium hover:underline">Logout</button>
      </div>

      {/* NOTIFICATIONS SECTION */}
      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.map(notif => (
            <div key={notif.id} className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex justify-between items-center">
              <p className="text-red-800 text-sm font-bold">{notif.message}</p>
              <button onClick={() => handleDismiss(notif.id)} className="text-red-500 text-xs hover:underline">Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* Score Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-blue-600">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-gray-500 text-sm uppercase tracking-wide">Family Priority Score</h2>
            <p className="text-4xl font-bold text-blue-900 mt-2">{family?.base_priority_score}</p>
          </div>
          <div className="text-right">
             <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">Good Standing</span>
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
      <div className="flex flex-col gap-4 mb-8">
        <button onClick={() => router.push('/booking')} className="bg-blue-600 text-white p-6 rounded-xl shadow hover:bg-blue-700 transition flex items-center justify-center gap-3">
          <span className="text-2xl">📅</span>
          <span className="font-bold text-lg">Book New Dates</span>
        </button>
        
        {/* THE RESTORED BUTTON */}
        <button onClick={() => router.push('/trips')} className="bg-purple-600 text-white p-4 rounded-xl shadow hover:bg-purple-700 transition flex items-center justify-center gap-3">
          <span className="text-2xl">🏡</span>
          <span className="font-bold text-lg">All Farmhouse Trips</span>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => router.push('/calendar')} className="bg-white text-gray-700 p-4 rounded-xl shadow border border-gray-200 transition flex flex-col items-center justify-center hover:bg-blue-700 hover:text-white hover:border-transparent group">
            <span className="text-2xl mb-2 group-hover:brightness-0 group-hover:invert">🗓️</span>
            <span className="font-bold">View Calendar</span>
          </button>
          <button onClick={() => router.push('/leaderboard')} className="bg-white text-gray-700 p-4 rounded-xl shadow border border-gray-200 transition flex flex-col items-center justify-center hover:bg-blue-700 hover:text-white hover:border-transparent group">
            <span className="text-2xl mb-2 group-hover:brightness-0 group-hover:invert">🏆</span>
            <span className="font-bold">Leaderboard</span>
          </button>
        </div>
      </div>

      {/* UPCOMING TRIPS SECTION */}
      <h3 className="text-lg font-bold text-gray-800 mb-4">Your Active Trips</h3>
      {bookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
          <p>No active bookings found.</p>
          <p className="text-sm mt-2">Plan a trip soon!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const hasStarted = new Date(booking.start_date) <= new Date()
            const alreadyCheckedIn = booking.inspections && booking.inspections.length > 0
            const showCheckIn = hasStarted && !alreadyCheckedIn

            return (
              <div key={booking.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-800">
                    {new Date(booking.start_date).toLocaleDateString()} — {new Date(booking.end_date).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded ${booking.booking_type === 'FAMILY' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                      {booking.booking_type}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                      {booking.status}
                    </span>
                    {alreadyCheckedIn && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-300">
                        ✅ Checked In
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {showCheckIn ? (
                    <button onClick={() => router.push(`/inspection?id=${booking.id}`)} className="bg-red-600 text-white text-xs font-bold px-3 py-2 rounded shadow hover:bg-red-700 animate-bounce">
                      🚨 Check In
                    </button>
                  ) : (
                    <button onClick={() => handleCancel(booking)} disabled={cancelLoading} className="text-red-600 font-medium text-sm hover:underline hover:text-red-800 disabled:opacity-50">
                      Cancel Trip
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}