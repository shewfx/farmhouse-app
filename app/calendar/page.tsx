'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../utils/supabaseClient'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css' 

export default function CalendarPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [selectedBooking, setSelectedBooking] = useState<any>(null)

  useEffect(() => {
    async function fetchBookings() {
      const { data } = await supabase
        .from('bookings')
        .select('*, users(full_name), families(name)') 
        .neq('status', 'CANCELLED')
      
      if (data) setBookings(data)
    }
    fetchBookings()
  }, [])

  function getTileClassName({ date, view }: { date: Date; view: string }) {
    if (view !== 'month') return ''

    const isBooked = bookings.some(booking => {
      const start = new Date(booking.start_date)
      const end = new Date(booking.end_date)
      start.setHours(0,0,0,0)
      end.setHours(0,0,0,0)
      date.setHours(0,0,0,0)
      return date >= start && date <= end
    })

    return isBooked ? 'booked-date' : 'free-date'
  }

  function onDateClick(date: Date) {
    setSelectedDate(date)
    
    const found = bookings.find(booking => {
      const start = new Date(booking.start_date)
      const end = new Date(booking.end_date)
      start.setHours(0,0,0,0)
      end.setHours(0,0,0,0)
      date.setHours(0,0,0,0)
      return date >= start && date <= end
    })

    setSelectedBooking(found || null)
  }

  // Helper to handle booking navigation
  function handleBookClick() {
    if (selectedDate) {
      // Convert date to YYYY-MM-DD format (local time) to avoid timezone shifts
      const offset = selectedDate.getTimezoneOffset()
      const localDate = new Date(selectedDate.getTime() - (offset*60*1000))
      const dateStr = localDate.toISOString().split('T')[0]
      
      router.push(`/booking?date=${dateStr}`)
    } else {
      router.push('/booking')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div className="flex justify-between w-full max-w-4xl mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Availability Calendar</h1>
        <button onClick={() => router.push('/dashboard')} className="text-blue-600 font-medium">
          &larr; Back to Dashboard
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
        
        <div className="bg-white p-6 rounded-xl shadow-lg flex-1">
          <Calendar 
            onClickDay={onDateClick}
            tileClassName={getTileClassName}
            className="w-full border-none"
            value={selectedDate}
          />
          <div className="flex gap-4 mt-4 text-sm justify-center">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-200 rounded-full"></div>
                <span>Booked</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                <span>Free</span>
             </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg w-full md:w-80 h-fit">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            {selectedDate?.toDateString()}
          </h2>

          {selectedBooking ? (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 text-red-800 rounded-lg border border-red-200">
                <span className="font-bold block">Occupied</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Booked by</p>
                <p className="font-medium">{selectedBooking.users?.full_name}</p>
                <p className="text-sm text-gray-600">({selectedBooking.families?.name})</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <span className={`text-xs px-2 py-1 rounded ${selectedBooking.booking_type === 'FAMILY' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                    {selectedBooking.booking_type}
                </span>
              </div>
            </div>
          ) : (
             <div className="text-center py-8">
               <div className="text-green-500 text-4xl mb-2">✓</div>
               <p className="font-bold text-gray-700">Available</p>
               
               {/* UPDATED BUTTON to use new handler */}
               <button 
                 onClick={handleBookClick}
                 className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-blue-700 w-full font-bold shadow-md"
               >
                 Book This Date
               </button>
             </div>
          )}
        </div>

      </div>
    </div>
  )
}