'use client' // This tells Next.js this runs in the browser
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabaseClient'

export default function Home() {
  const [families, setFamilies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getFamilies() {
      // THE SQL EQUIVALENT: "SELECT * FROM families"
      const { data, error } = await supabase
        .from('families')
        .select('*')

      if (error) {
        console.error('Error fetching families:', error)
      } else {
        setFamilies(data || [])
      }
      setLoading(false)
    }

    getFamilies()
  }, [])

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">NazVik Konnect</h1>
      
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {families.map((family) => (
            <div key={family.id} className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">{family.name}</h2>
              <div className="mt-2 text-sm text-gray-600">
                <p>Priority Score: <span className="font-bold text-green-600">{family.base_priority_score}</span></p>
                <p>Secret PIN: {family.pin_code} (Hidden in real app)</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}