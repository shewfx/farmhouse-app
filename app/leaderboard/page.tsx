'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../utils/supabaseClient'

export default function Leaderboard() {
  const router = useRouter()
  const [families, setFamilies] = useState<any[]>([])
  const [myFamilyId, setMyFamilyId] = useState<string | null>(null)

  useEffect(() => {
    async function getData() {
      const storedFamilyId = localStorage.getItem('farmhouse_family_id')
      setMyFamilyId(storedFamilyId)

      const { data } = await supabase
        .from('families')
        .select('*')
        .order('base_priority_score', { ascending: false })

      if (data) setFamilies(data)
    }
    getData()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🏆 Rankings</h1>
          <button 
            onClick={() => router.push('/dashboard')}
            className="bg-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm"
          >
            &larr; Back
          </button>
        </div>

        {/* The List */}
        <div className="space-y-3">
          {families.map((family, index) => {
            const isMe = String(family.id) === myFamilyId
            let rankEmoji = '🔹'
            if (index === 0) rankEmoji = '🥇'
            if (index === 1) rankEmoji = '🥈'
            if (index === 2) rankEmoji = '🥉'

            return (
              <div 
                key={family.id}
                className={`flex items-center justify-between p-4 rounded-xl shadow-sm border-2 transition-all ${
                  isMe 
                    ? 'border-gray-600 bg-white transform scale-105 z-10' // Active: Dark border, pop out
                    : 'border-transparent bg-white opacity-90' // Inactive: Blend in
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl filter grayscale">{rankEmoji}</span>
                  <div>
                    <h2 className={`font-bold text-lg ${isMe ? 'text-gray-900' : 'text-gray-600'}`}>
                      {family.name}
                    </h2>
                    {isMe && <span className="text-xs bg-gray-800 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">You</span>}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{family.base_priority_score}</p>
                  <p className="text-xs text-gray-500 uppercase font-bold">Points</p>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}