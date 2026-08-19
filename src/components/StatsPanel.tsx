import type { DinosaurConfig } from '../game/dinosaurTypes'
import { calculateStats } from '../game/calculateStats'

export function StatsPanel({ config, onExplain }: {
  config: DinosaurConfig
  /** Opens the guide to what each part does on each terrain. */
  onExplain?: () => void
}) {
  return <section className="stats">
    <div className="stats-head">
      <h2>🏁 Race Stats</h2>
      {onExplain && (
        <button className="stats-info" type="button" onClick={onExplain}>
          ⓘ What do these do?
        </button>
      )}
    </div>
    {Object.entries(calculateStats(config)).map(([stat, value]) => <div className="stat" key={stat}>
      <span>{stat}</span>
      <span aria-label={`${value} out of 5`}>{[0, 1, 2, 3, 4].map((step) => <i className={step < value ? 'on' : ''} key={step} />)}</span>
    </div>)}
  </section>
}
