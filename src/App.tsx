import { useMemo, useState } from 'react'
import { DinoScene } from './components/DinoScene'
import { PartSelector } from './components/PartSelector'
import { StatsPanel } from './components/StatsPanel'
import { SaveDinoModal } from './components/SaveDinoModal'
import { RacingGuide } from './components/RacingGuide'
import { BODIES, COLORS, COLOR_NAMES, DEFAULT_DINO, FEATURES, FEET, FRONT_LIMBS, HEADS, HIND_LEGS, PATTERN_COLORS, PATTERN_COLOR_NAMES, SKINS, TAILS, isBiped, type DinosaurConfig } from './game/dinosaurTypes'
import { deleteDinosaur, loadRoster, saveDinosaur } from './game/storage'
import type { SavedDinosaur } from './game/dinosaurTypes'

const pick = <T,>(options: readonly T[]) => options[Math.floor(Math.random() * options.length)]

export default function App() {
  const [roster, setRoster] = useState<SavedDinosaur[]>(loadRoster)
  const [dino, setDino] = useState<DinosaurConfig>(DEFAULT_DINO)
  const [saved, setSaved] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const set = <K extends keyof DinosaurConfig>(key: K, value: DinosaurConfig[K]) => setDino((current) => ({ ...current, [key]: value }))

  const removeDino = (id: string) => {
    deleteDinosaur(id)
    setRoster(loadRoster())
  }

  const randomize = () => setDino((current) => ({
    ...current,
    head: pick(HEADS), body: pick(BODIES), frontLimbs: pick(FRONT_LIMBS), hindLegs: pick(HIND_LEGS),
    feet: pick(FEET), tail: pick(TAILS), feature: pick(FEATURES), color: pick(COLORS), skin: pick(SKINS),
    patternColor: pick(PATTERN_COLORS),
  }))

  const save = () => {
    const cleanDino = { ...dino, name: dino.name.trim() || 'Chompy' }
    setDino(cleanDino)
    saveDinosaur(cleanDino)
    setRoster(loadRoster())
    setSaved(true)
  }

  const biped = isBiped(dino)

  // The complementary colour paints every piece of trim, so tell the player
  // exactly what it is doing on the build they have right now.
  const trim = [
    dino.skin === 'Spotted' && 'spots',
    dino.skin === 'Striped' && 'stripes',
    dino.head === 'Triceratops' && 'frill',
    dino.head === 'Parasaurolophus' && 'crest',
    dino.head === 'Brachiosaurus' && 'head crest',
    dino.feature === 'Wings' && 'wings',
    dino.feature === 'Plates' && 'plates',
    dino.feature === 'Back Spikes' && 'back spikes',
    dino.tail === 'Spiked Tail' && 'tail spikes',
    dino.feet === 'Webbed Feet' && 'foot webbing',
  ].filter(Boolean) as string[]
  const trimText = trim.length > 1
    ? `${trim.slice(0, -1).join(', ')} and ${trim[trim.length - 1]}`
    : trim[0]

  return (
    <main>
      <header>
        <span>🧪</span>
        <div><h1>DINO LAB</h1><p>Build your own dinosaur!</p></div>
        <div className="go-play">
          <a className="to-race" href="./race.html">🏁<span>RACE<br />TRACK</span></a>
          <a className="to-run" href="./run.html">🌟<span>STAR<br />DASH</span></a>
        </div>
      </header>

      {roster.length > 0 && <aside className="stable" aria-label="Your saved dinosaurs">
        <div className="stable-head">
          <b>🦕 MY DINOSAURS</b>
          <a className="stable-race" href="./race.html">🏁 TAKE THEM RACING</a>
        </div>
        <ul>{roster.map((entry) => <li key={entry.id}>
          <i style={{ background: entry.config.color }} />
          <div><strong>{entry.config.name}</strong><small>{entry.config.head} · {entry.config.body.toLowerCase()}</small></div>
          <button className="stable-load" onClick={() => setDino(entry.config)}>LOAD</button>
          <button className="stable-delete" aria-label={`Delete ${entry.config.name}`} onClick={() => removeDino(entry.id)}>✕</button>
        </li>)}</ul>
      </aside>}
      <div className="builder">
        <section className="preview">
          <DinoScene config={dino} />
          <div className={`stance ${biped ? 'biped' : ''}`}><span>{biped ? '🦖' : '🦕'}</span><div><small>BODY STYLE</small><strong>{biped ? 'TWO-LEGGED' : 'FOUR-LEGGED'}</strong></div></div>
          <StatsPanel config={dino} onExplain={() => setGuideOpen(true)} />
        </section>
        <section className="controls">
          <label className="name"><b>✏️ Name your dinosaur</b><input maxLength={20} value={dino.name} onChange={(event) => set('name', event.target.value)} placeholder="Chompy" /></label>
          <div className="section-title"><span>🧬</span><div><strong>BUILD THE BODY</strong><small>Tap the arrows to mix and match</small></div></div>
          <div className="parts">
            <PartSelector label="HEAD TYPE" icon="😄" value={dino.head} options={HEADS} onChange={(value) => set('head', value)} />
            <PartSelector label="BODY SIZE" icon="🦕" value={dino.body} options={BODIES} onChange={(value) => set('body', value)} />
            <PartSelector label="FRONT LIMBS" icon="💪" value={dino.frontLimbs} options={FRONT_LIMBS} onChange={(value) => set('frontLimbs', value)} />
            <PartSelector label="BACK LEGS" icon="🦵" value={dino.hindLegs} options={HIND_LEGS} onChange={(value) => set('hindLegs', value)} />
            <PartSelector label="FEET" icon="🐾" value={dino.feet} options={FEET} onChange={(value) => set('feet', value)} />
            <PartSelector label="TAIL" icon="〰️" value={dino.tail} options={TAILS} onChange={(value) => set('tail', value)} />
            <PartSelector label="EXTRA FEATURE" icon="✨" value={dino.feature} options={FEATURES} onChange={(value) => set('feature', value)} />
            <PartSelector label="SKIN" icon="🔵" value={dino.skin} options={SKINS} onChange={(value) => set('skin', value)} />
          </div>
          <div className="colors"><h2>🎨 DINO COLOR</h2><div>{COLORS.map((color, index) => <button key={color} aria-label={COLOR_NAMES[index]} className={dino.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => set('color', color)}>✓</button>)}</div></div>
          <div className={`colors pattern${trim.length ? '' : ' idle'}`}>
            <h2>🎨 COMPLEMENTARY COLOR</h2>
            <div>{PATTERN_COLORS.map((color, index) => <button key={color} aria-label={PATTERN_COLOR_NAMES[index]} className={dino.patternColor === color ? 'selected' : ''} style={{ background: color }} onClick={() => set('patternColor', color)}>✓</button>)}</div>
            <small>{trim.length ? `Colors your ${trimText}` : 'Add spots, stripes, spikes, a crest or wings to use this'}</small>
          </div>
          <p className="limb-tip">💡 Choosing arms makes a two-legged dinosaur. Front legs make a four-legged dinosaur and change its body angle.</p>
          <div className="actions"><button className="random" onClick={randomize}>🎲 RANDOM DINO</button><button className="reset" onClick={() => setDino(DEFAULT_DINO)}>↻ RESET</button><button className="primary save" onClick={save}>💾 SAVE MY DINO</button></div>
        </section>
      </div>
      <footer>Made with big ideas and tiny fossils 🦴</footer>
      {saved && <SaveDinoModal config={dino} onClose={() => setSaved(false)} />}
      {guideOpen && <RacingGuide config={dino} onClose={() => setGuideOpen(false)} />}
    </main>
  )
}
