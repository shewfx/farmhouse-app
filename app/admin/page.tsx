'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../utils/supabaseClient'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [families, setFamilies] = useState<any[]>([])
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const userId = localStorage.getItem('farmhouse_user_id')
    if (!userId) {
      router.push('/login')
      return
    }

    // 1. Verify Role
    const { data: user } = await supabase.from('users').select('role').eq('id', userId).single()
    
    if (user?.role !== 'ADMIN') {
      alert('⛔ Access Denied: Admins only.')
      router.push('/dashboard')
      return
    }

    setIsAdmin(true)
    fetchFamilies()
  }

  async function fetchFamilies() {
    const { data } = await supabase.from('families').select('*').order('id', { ascending: true })
    if (data) setFamilies(data)
    setLoading(false)
  }

  // === ACTION: THE GREAT RESET ===
  async function handleGlobalReset() {
    if (!confirm('⚠️ WARNING: This will reset ALL families to 250 points. This cannot be undone. Continue?')) return
    
    setResetting(true)
    const { error } = await supabase.from('families').update({ base_priority_score: 250 }).neq('id', 0) // Update all
    
    if (error) alert('Reset failed')
    else {
        alert('✅ Success! New Year, New Scores.')
        fetchFamilies()
    }
    setResetting(false)
  }

  // === ACTION: MANUAL BONUS ===
  async function handleBonus(familyId: number, currentScore: number, amount: number) {
    const newScore = currentScore + amount
    await supabase.from('families').update({ base_priority_score: newScore }).eq('id', familyId)
    fetchFamilies()
  }

  if (loading) return <div className="p-10 text-center">Verifying Access...</div>

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🛠️ Admin Control</h1>
            <p className="text-gray-500">Manage economy and scores</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="bg-white px-4 py-2 rounded border hover:bg-gray-100">
            Exit
          </button>
        </div>

        {/* THE NUCLEAR OPTION */}
        <div className="bg-white p-6 rounded-xl shadow mb-8 border-l-4 border-red-500">
          <h2 className="text-xl font-bold text-red-700 mb-2">⚠️ The Great Reset</h2>
          <p className="text-gray-600 mb-4">Use this on January 1st. It resets every single family's score back to the default 250.</p>
          <button 
            onClick={handleGlobalReset}
            disabled={resetting}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 w-full sm:w-auto"
          >
            {resetting ? 'Resetting...' : '🔴 Reset All Scores to 250'}
          </button>
        </div>

        {/* FAMILY LIST & MANUAL ADJUSTMENT */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-4 bg-gray-100 border-b font-bold text-gray-700">Family Economy</div>
          
          <div className="divide-y">
            {families.map(family => (
              <div key={family.id} className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <div className="font-bold text-lg text-gray-800">{family.name}</div>
                  <div className="text-sm text-gray-500">Current Score: <span className="font-mono font-bold text-black">{family.base_priority_score}</span></div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleBonus(family.id, family.base_priority_score, 10)}
                    className="bg-green-100 text-green-800 px-3 py-1 rounded border border-green-200 hover:bg-green-200 font-bold"
                  >
                    +10 Bonus
                  </button>
                  <button 
                    onClick={() => handleBonus(family.id, family.base_priority_score, 50)}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded border border-blue-200 hover:bg-blue-200 font-bold"
                  >
                    +50 Amnesty
                  </button>
                  <button 
                    onClick={() => handleBonus(family.id, family.base_priority_score, -10)}
                    className="bg-red-50 text-red-800 px-3 py-1 rounded border border-red-200 hover:bg-red-100 font-bold"
                  >
                    -10 Fine
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}