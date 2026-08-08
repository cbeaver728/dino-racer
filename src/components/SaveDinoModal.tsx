import type { DinosaurConfig } from '../game/dinosaurTypes'
import { DinoScene } from './DinoScene'

export function SaveDinoModal({ config, onClose }: { config: DinosaurConfig; onClose: () => void }) {
  return <div className="backdrop" role="dialog" aria-modal="true">
    <div className="modal">
      <b className="confetti">🎉🦕🎊</b>
      <h2>DINOSAUR SAVED!</h2>
      <p><strong>{config.name}</strong> is ready for adventure!</p>
      <div className="mini"><DinoScene config={config} /></div>
      <div className="modal-actions">
        <button className="primary" onClick={onClose}>KEEP BUILDING</button>
        <a className="modal-race" href="./race.html">🏁 TO THE RACE TRACK</a>
      </div>
    </div>
  </div>
}
