import type { DinosaurConfig } from '../game/dinosaurTypes'
import { calculateStats } from '../game/calculateStats'

/**
 * What each bar does on the track, so a child can tell why a part is worth
 * picking. Shown as a caption rather than per-row text to keep the grid intact.
 */
const STAT_NOTE = 'Speed, balance and swimming set your pace on each terrain. '
  + 'Strength shakes off tornadoes faster. Stamina holds your pace to the finish.'

export function StatsPanel({ config }: { config: DinosaurConfig }) {
  return <section className="stats">
    <h2>🏁 Race Stats</h2>
    {Object.entries(calculateStats(config)).map(([stat, value]) => <div className="stat" key={stat}>
      <span>{stat}</span>
      <span aria-label={`${value} out of 5`}>{[0, 1, 2, 3, 4].map((step) => <i className={step < value ? 'on' : ''} key={step} />)}</span>
    </div>)}
    <p className="stats-note">{STAT_NOTE}</p>
  </section>
}
