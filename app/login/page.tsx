'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const [families, setFamilies] = useState<any[]>([])
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    familyId: '',
    pin: ''
  })
  const [error, setError] = useState('')

  useEffect(() => {
    async function getFamilies() {
      const { data } = await supabase.from('families').select('*')
      if (data) setFamilies(data)
    }
    getFamilies()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const selectedFamily = families.find(f => f.id.toString() === formData.familyId)
    
    if (!selectedFamily) {
      setError('Please select a family')
      return
    }

    if (formData.pin !== selectedFamily.pin_code) {
      setError('Incorrect PIN for this family!')
      return
    }

    const userId = crypto.randomUUID()
    
    const { error: dbError } = await supabase.from('users').insert([
      {
        id: userId,
        full_name: formData.fullName,
        phone: formData.phone,
        family_id: selectedFamily.id,
        role: 'MEMBER'
      }
    ])

    if (dbError) {
      console.error(dbError)
      setError('Error creating user. Try again.')
      return
    }

    localStorage.setItem('farmhouse_user_id', userId)
    localStorage.setItem('farmhouse_family_id', selectedFamily.id)
    
    router.push('/dashboard') 
  }

  return (
    // Updated background to match theme (gray-50 -> Cream)
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🏡 Farmhouse Connect</h1>
        <p className="text-gray-600">Family Booking System</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border-2 border-transparent">
        <h2 className="text-xl font-bold text-center mb-6 text-gray-800">Member Login</h2>
        
        <form onSubmit={handleLogin} className="space-y-5">
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Ali Khan"
              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-green-500 transition-colors"
              value={formData.fullName}
              onChange={e => setFormData({...formData, fullName: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Select Family</label>
            <div className="relative">
              <select 
                className="w-full p-3 border-2 border-gray-200 rounded-xl appearance-none bg-white focus:border-green-500 transition-colors"
                value={formData.familyId}
                onChange={e => setFormData({...formData, familyId: e.target.value})}
              >
                <option value="">-- Choose Household --</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                ▼
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Family PIN</label>
            <input 
              type="password" 
              required
              placeholder="••••"
              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-green-500 text-center text-2xl tracking-widest"
              value={formData.pin}
              onChange={e => setFormData({...formData, pin: e.target.value})}
            />
          </div>

          {error && <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm text-center font-bold">{error}</div>}

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-md hover:opacity-90 transition-opacity mt-4"
          >
            Enter App &rarr;
          </button>
        </form>
      </div>
    </div>
  )
}