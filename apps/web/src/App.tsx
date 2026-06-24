import { useEffect } from 'react'
import { Header } from './components/Header'
import { Translator } from './components/Translator'
import { fetchMeta } from './api'
import { useTranslationStore } from './store'

export default function App() {
  const setMeta = useTranslationStore((s) => s.setMeta)
  const setError = useTranslationStore((s) => s.setError)

  useEffect(() => {
    fetchMeta()
      .then(setMeta)
      .catch((err) => setError((err as Error).message))
  }, [setMeta, setError])

  return (
    <div className="flex min-h-screen w-full flex-col bg-deepl-light">
      <Header />
      <Translator />
    </div>
  )
}
