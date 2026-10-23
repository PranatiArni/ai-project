import { useEffect, useRef, useState } from 'react'

// Reads text aloud with the browser's built-in speech synthesis. Nothing is
// sent to an outside service. `supported` is false in browsers without it.
export function useSpeech() {
  const supported = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function'
  const [status, setStatus] = useState('idle')
  // Events from an utterance that was replaced or cancelled are ignored.
  const current = useRef(null)

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel()
  }, [supported])

  function speak(text) {
    if (!supported) return
    window.speechSynthesis.cancel()
    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    const finish = () => {
      if (current.current === utterance) setStatus('idle')
    }
    utterance.onend = finish
    utterance.onerror = finish
    current.current = utterance
    window.speechSynthesis.speak(utterance)
    setStatus('speaking')
  }

  function pause() {
    window.speechSynthesis.pause()
    setStatus('paused')
  }

  function resume() {
    window.speechSynthesis.resume()
    setStatus('speaking')
  }

  function stop() {
    if (!supported) return
    current.current = null
    window.speechSynthesis.cancel()
    setStatus('idle')
  }

  return { supported, status, speak, pause, resume, stop }
}
