'use client'
// Fix for Vercel Build Error: Force dynamic rendering for useSearchParams
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../utils/supabaseClient'

export default function BookingPage() {
  const router = useRouter()
  const searchParams = useSearchParams() 
  
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeBookings, setActiveBookings] = useState<any[]>([]) 
  
  // New State for Billing
  const [familyScore, setFamilyScore] = useState(0) 
  
  const [startDate, setStartDate] = useState(searchParams.get('date') || '')
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '')
  const [type, setType] = useState('FAMILY')

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const userId = localStorage.getItem('farmhouse_user_id')
    if (!userId) router.push('/login')
    
    fetchData()
  }, [])

  async function fetchData() {
    const userId = localStorage.getItem('farmhouse_user_id')
    const familyId = localStorage.getItem('farmhouse_family_id')

    // 1. Fetch Active Bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .gte('end_date', todayStr) 
      .neq('status', 'CANCELLED')
      .order('start_date', { ascending: true })
    if (bookings) setActiveBookings(bookings)

    // 2. Fetch Current Family Score (For the Bill)
    const { data: family } = await supabase
      .from('families')
      .select('base_priority_score')
      .eq('id', familyId)
      .single()
    
    if (family) setFamilyScore(family.base_priority_score)
  }

  // === HELPER: Calculate Bill Details ===
  function getBillDetails() {
    if (!startDate || !endDate) return null
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    // Reset hours
    start.setHours(0,0,0,0); end.setHours(0,0,0,0)

    if (start >= end) return null // Invalid range

    const diffTime = Math.abs(end.getTime() - start.getTime())
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    const rate = type === 'FAMILY' ? 5 : 8
    const totalCost = durationDays * rate
    const finalScore = familyScore - totalCost

    return { durationDays, rate, totalCost, finalScore }
  }

  const bill = getBillDetails()

  // === CANCELLATION LOGIC ===
  async function handleCancel(booking: any) {
     if (!confirm('Are you sure you want to cancel this trip?')) return;
     setLoading(true)
     
     const familyId = localStorage.getItem('farmhouse_family_id')

     // 1. CHECK GRACE PERIOD (1 Hour)
     const createdAt = new Date(booking.created_at).getTime()
     const now = new Date().getTime()
     const hoursSinceBooking = (now - createdAt) / (1000 * 60 * 60)

     // If booked less than 1 hour ago, cancel for free immediately
     if (hoursSinceBooking <= 1) {
        const { error } = await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', booking.id);
        if (error) {
            setMsg('Error cancelling booking.')
        } else {
            setMsg('✅ Booking Cancelled (Free - Grace Period)')
            fetchData() // Reload data
        }
        setLoading(false)
        return; // Exit function, do not charge penalty
     }

     // 2. CALCULATE PENALTY (If outside grace period)
     const start = new Date(booking.start_date)
     const today = new Date()
     start.setHours(0,0,0,0)
     today.setHours(0,0,0,0)

     const diffTime = start.getTime() - today.getTime()
     const daysBefore = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

     let penalty = 0
     let penaltyMsg = "Free Cancellation"

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

     // 3. APPLY PENALTY
     if (penalty > 0) {
       const { data: familyData } = await supabase
         .from('families')
         .select('base_priority_score')
         .eq('id', familyId)
         .single()
       
       const currentScore = familyData?.base_priority_score || 0
       const newScore = currentScore - penalty

       await supabase
         .from('families')
         .update({ base_priority_score: newScore })
         .eq('id', familyId)
     }

     // 4. UPDATE BOOKING STATUS
     const { error } = await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', booking.id);
     
     if (error) {
        setMsg('Error cancelling booking.')
     } else {
        setMsg(penalty > 0 
          ? `⚠️ Booking Cancelled. Penalty: -${penalty} pts (${penaltyMsg})` 
          : '✅ Booking Cancelled (No Penalty)')
        fetchData();
     }
     setLoading(false)
  }

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    const userId = localStorage.getItem('farmhouse_user_id')
    const familyId = localStorage.getItem('farmhouse_family_id')

    // 1. DATES & QUOTA CHECK
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (startDate < todayStr || start >= end) {
      setMsg('Error: Invalid Dates.')
      setLoading(false)
      return
    }

    const { count: activeCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true }) 
      .eq('family_id', familyId)
      .gte('end_date', todayStr)
      .neq('status', 'CANCELLED')
    
    if (activeCount && activeCount >= 2) {
      setMsg(`🚫 Limit reached (2 max).`)
      setLoading(false)
      return
    }

    // 2. CONFLICT & PRIORITY BATTLE
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('*, families(base_priority_score, name)') 
      .neq('status', 'CANCELLED')
      .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)

    let bookingStatus = 'PENDING'
    let battleWon = false
    let battleMsg = ''

    if (conflicts && conflicts.length > 0) {
      const conflict = conflicts[0]
      
      if (conflict.status === 'CONFIRMED') {
        setMsg(`❌ Dates Locked. Already confirmed by ${conflict.families?.name || 'someone'}.`)
        setLoading(false)
        return
      }

      if (conflict.status === 'PENDING') {
        const { data: myFamily } = await supabase.from('families').select('base_priority_score, name').eq('id', familyId).single()
        const myScore = myFamily?.base_priority_score || 0
        const theirScore = conflict.families?.base_priority_score || 0

        if (myScore > theirScore) {
           battleWon = true
           bookingStatus = 'CONFIRMED'
           battleMsg = `⚔️ PRIORITY BATTLE WON! (${myScore} vs ${theirScore}).`
           
           await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', conflict.id)
           await supabase.from('notifications').insert([{
             family_id: conflict.family_id,
             message: `⚠️ Your booking for ${startDate} was CHALLENGED and CANCELLED by ${myFamily?.name} because they had a higher Priority Score (${myScore} vs ${theirScore}).`
           }])

        } else {
           setMsg(`❌ Priority Too Low. Pending request has score ${theirScore} (You: ${myScore}).`)
           setLoading(false)
           return
        }
      }
    }

    // 3. SAVE
    // Note: We recalculate cost here securely just in case
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) 
    const totalCost = durationDays * (type === 'FAMILY' ? 5 : 8)

    const { error } = await supabase.from('bookings').insert([{
        user_id: userId,
        family_id: familyId,
        start_date: startDate,
        end_date: endDate,
        booking_type: type,
        status: bookingStatus
    }])

    if (error) {
      setMsg('Error saving.')
    } else {
      // 4. CONDITIONAL SCORE DEDUCTION
      if (bookingStatus === 'CONFIRMED') {
        const { data: familyData } = await supabase.from('families').select('base_priority_score').eq('id', familyId).single()
        const newScore = (familyData?.base_priority_score || 0) - totalCost
        await supabase.from('families').update({ base_priority_score: newScore }).eq('id', familyId)
      } 

      const successText = battleWon ? battleMsg : `⏳ Booking Requested! Status: PENDING (2 Days Window). Cost: ${totalCost} pts (Deducted only if confirmed).`
      setMsg(`✅ ${successText}`)
      setTimeout(() => router.push('/dashboard'), 2500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Book Dates</h1>
          <form onSubmit={handleBooking} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check In</label>
                <input type="date" required min={todayStr} className="w-full p-3 border border-gray-300 rounded-lg text-lg" value={startDate} onChange={e => setStartDate(e.target.value)}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Out</label>
                <input type="date" required min={startDate || todayStr} className="w-full p-3 border border-gray-300 rounded-lg text-lg" value={endDate} onChange={e => setEndDate(e.target.value)}/>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Who is going?</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer text-center transition-all ${type === 'FAMILY' ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold shadow-sm' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="type" value="FAMILY" className="hidden" checked={type === 'FAMILY'} onChange={() => setType('FAMILY')}/>
                  <span className="block text-xl mb-1">👨‍👩‍👧‍👦</span>
                  Family <span className="text-xs opacity-75 block font-normal">(5 pts)</span>
                </label>
                <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer text-center transition-all ${type === 'FRIENDS' ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold shadow-sm' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="type" value="FRIENDS" className="hidden" checked={type === 'FRIENDS'} onChange={() => setType('FRIENDS')}/>
                  <span className="block text-xl mb-1">😎</span>
                  Friends <span className="text-xs opacity-75 block font-normal">(8 pts)</span>
                </label>
              </div>
            </div>

            {/* === NEW BILLING SUMMARY SECTION === */}
            {bill && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <h3 className="font-bold text-gray-800 border-b pb-2 border-gray-300">Trip Score Invoice</h3>
                
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Current Score:</span>
                  <span className="font-bold">{familyScore}</span>
                </div>
                
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Rate ({type.toLowerCase()}):</span>
                  <span>{bill.rate} x {bill.durationDays} days</span>
                </div>

                <div className="flex justify-between text-sm text-red-600 font-bold">
                  <span>Trip Cost:</span>
                  <span>- {bill.totalCost} pts</span>
                </div>

                <div className="border-t pt-2 flex justify-between text-base font-bold text-gray-900">
                  <span>Remaining Score:</span>
                  <span className={bill.finalScore < 0 ? 'text-red-600' : 'text-green-700'}>
                    {bill.finalScore}
                  </span>
                </div>
              </div>
            )}
            {/* =================================== */}

            {msg && (
              <div className={`p-4 rounded-lg text-sm font-bold text-center ${msg.includes('✅') ? 'bg-green-100 text-green-800' : msg.includes('⏳') ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                {msg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => router.back()} className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              <button type="submit" disabled={loading || !bill} className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-md transition-all active:scale-95">
                {loading ? 'Processing...' : 'Confirm Booking'}
              </button>
            </div>
          </form>
        </div>
        
        {/* ACTIVE BOOKINGS LIST */}
        {activeBookings.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>🎟️</span> Your Active Bookings
            </h2>
            
            <div className="space-y-4">
              {activeBookings.map(booking => (
                <div key={booking.id} className="p-4 rounded-lg bg-gray-50 border border-gray-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-800">
                      {new Date(booking.start_date).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Until {new Date(booking.end_date).toLocaleDateString()}
                    </div>
                    <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded ${booking.booking_type === 'FAMILY' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                      {booking.booking_type}
                    </span>
                  </div>

                  <button 
                    onClick={() => handleCancel(booking)}
                    disabled={loading}
                    className="px-3 py-2 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-400 mt-4 text-center">
              ⚠️ Cancellation Policy: -15 pts (1 day before), -8 pts (2 days), -5 pts (3 days). Free within 1 hr of booking.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}