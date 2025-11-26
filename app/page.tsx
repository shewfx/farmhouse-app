import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect root URL to the login page immediately
  redirect('/login')
}