import { useSyncExternalStore } from 'react'
import { isMuted, playTap, setMuted, subscribeToMute, unlock } from '../game/sound'

/**
 * Speaker button shared by the race and the run. Unmuting is a real gesture, so
 * it doubles as the moment the audio context is allowed to start.
 */
export function SoundToggle({ className }: { className?: string }) {
  const muted = useSyncExternalStore(subscribeToMute, isMuted, () => false)

  return <button
    type="button"
    className={`sound-toggle${className ? ` ${className}` : ''}`}
    aria-pressed={!muted}
    aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
    onClick={() => {
      unlock()
      setMuted(!muted)
      if (muted) playTap()
    }}
  >{muted ? '🔇' : '🔊'}</button>
}
