import type { DinosaurConfig } from '../game/dinosaurTypes'
import { TERRAIN_RULES, paceIndex, paceWord, toRaceProfile } from '../race/raceSimulation'
import { COURSE } from '../race/raceTypes'

/**
 * What every part does on every terrain, read straight off the rules the race
 * actually runs on.
 *
 * Nothing here is written out by hand. The table in `raceSimulation` is the one
 * the simulation walks, so a line in this panel cannot claim something the race
 * does not do — and when a number is tuned, the panel changes with it. Rules the
 * current build already has are marked, which turns the guide from a manual
 * into a read-out of the dinosaur on the bench.
 */
export function RacingGuide({ config, onClose }: { config: DinosaurConfig; onClose: () => void }) {
  const profile = toRaceProfile(config)

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="How racing works">
      <div className="modal guide">
        <button className="guide-close" type="button" aria-label="Close" onClick={onClose}>✕</button>
        <b className="confetti">🏁</b>
        <h2>How racing works</h2>
        <p className="guide-intro">
          Every part you pick changes how fast your dinosaur runs over each kind of ground.
          A tick means <strong>{config.name || 'your dinosaur'}</strong> already has it.
          <br />The number on each patch is how it runs there next to an average dinosaur —
          over 100% is quicker than most, under 100% is slower.
        </p>

        {COURSE.map((section) => {
          const index = paceIndex(profile, section.terrain)
          const percent = Math.round(index * 100)
          return (
            <section className="guide-terrain" key={section.terrain}>
              <header>
                <span className="guide-icon">{section.icon}</span>
                <div>
                  <strong>{section.terrain}</strong>
                  <small>{section.description}</small>
                </div>
                <em className={percent >= 100 ? 'guide-pace fast' : 'guide-pace slow'}>
                  <b>{percent}%</b>
                  <small>{paceWord(index)}</small>
                </em>
              </header>
              <ul>
                {TERRAIN_RULES[section.terrain].map((rule) => {
                  const has = rule.applies(profile)
                  const helps = rule.amount >= 0
                  return (
                    <li key={`${rule.trait}-${rule.choice}`} className={has ? 'has' : ''}>
                      <i className={helps ? 'up' : 'down'}>{helps ? '▲' : '▼'}</i>
                      <span className="guide-choice">{rule.trait}: <b>{rule.choice}</b></span>
                      <span className="guide-note">{rule.note}</span>
                      <span className="guide-tick">{has ? '✓' : ''}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        <section className="guide-terrain guide-extra">
          <header>
            <span className="guide-icon">💪</span>
            <div>
              <strong>Strength and stamina</strong>
              <small>These two do their own jobs, on every track.</small>
            </div>
          </header>
          <ul>
            <li className="has">
              <i className="up">▲</i>
              <span className="guide-choice">Strength</span>
              <span className="guide-note">Gets back up faster after a tornado spins you around</span>
              <span className="guide-tick">{profile.strength}/5</span>
            </li>
            <li className="has">
              <i className="up">▲</i>
              <span className="guide-choice">Stamina</span>
              <span className="guide-note">Holds your pace to the finish; a low one fades on the last lap</span>
              <span className="guide-tick">{profile.stamina}/5</span>
            </li>
          </ul>
        </section>

        <p className="guide-foot">
          On Smoking Isle the road splits three times. Both ways are the same distance,
          so take the ground your dinosaur is best on — and steer around the lava.
        </p>
        <button className="primary guide-done" type="button" onClick={onClose}>Got it!</button>
      </div>
    </div>
  )
}
