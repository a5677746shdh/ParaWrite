import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { Translator } from './components/Translator'
import { AuthGate } from './components/AuthGate'
import { fetchMeta } from './api'
import { useTheme } from './hooks/useTheme'
import { useTranslationStore } from './store'

export default function App() {
  const setMeta = useTranslationStore((s) => s.setMeta)
  const setError = useTranslationStore((s) => s.setError)
  const meta = useTranslationStore((s) => s.meta)
  const [authenticated, setAuthenticated] = useState(false)

  useTheme(meta?.theme)

  const loadMeta = () => {
    fetchMeta()
      .then((m) => {
        setMeta(m)
        if (!m.authRequired || m.authenticated) {
          setAuthenticated(true)
        }
      })
      .catch((err) => setError((err as Error).message))
  }

  useEffect(() => {
    loadMeta()
  }, [setMeta, setError])

  const handleAuthenticated = () => {
    setAuthenticated(true)
    loadMeta()
  }

  if (meta?.authRequired && !authenticated) {
    return <AuthGate onAuthenticated={handleAuthenticated} />
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-deepl-light">
      <Header />
      <Translator />
    </div>
  )
}
