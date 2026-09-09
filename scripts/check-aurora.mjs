import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { COURSES, buildCourse } = await server.ssrLoadModule('/src/race/course.ts')
  const { createRacers, stepRacer, LAP_COUNT } = await server.ssrLoadModule('/src/race/raceEngine.ts')
  const { RIVALS } = await server.ssrLoadModule('/src/game/rivals.ts')
  const course = COURSES.find((entry) => entry.def.id === 'aurora')
  assert.equal(COURSES.length, 4)
  assert(course)
  assert.equal(course.splits.length, 2)
  const routes = [[0, 0], [0, 1], [1, 0], [1, 1]]
  for (const split of course.splits) {
    assert(Math.abs(split.branches[0].getLength() - split.branches[1].getLength()) < 1e-6, 'Forks must be equal length')
  }
  for (const route of routes) {
    for (const lane of [-1.05, 0, 1.05]) {
      let previous = course.frameAt(0, lane, route).position
      for (let i = 1; i <= 3000; i++) {
        const frame = course.frameAt(i / 3000, lane, route)
        assert([...frame.position, frame.heading].every(Number.isFinite), 'Invalid track frame')
        assert(frame.position.distanceTo(previous) < .25, 'A racer jumps at a road seam')
        assert(frame.position.y >= .12, 'Road sinks below the island')
        previous = frame.position
      }
    }
  }
  console.log('PASS: four courses; equal-length forks; all four routes continuous in every racing lane.')

  const neutral = buildCourse({ ...course.def, currents: [] })
  for (const zone of course.def.currents) {
    for (const t of [zone.from + .001, (zone.from + zone.to) / 2, zone.to - .001]) {
      assert.equal(course.currentAt(t), 1.25)
      assert.equal(course.currentAt(t + 1), 1.25)
      assert.equal(course.currentAt(t - 1), 1.25)
      assert.equal(course.splitAt(t), null, 'Current gate must be on a shared road')
      for (const lane of [-1.05, 0, 1.05]) {
        const a = createRacers([RIVALS[0]], course)[0]
        const b = createRacers([RIVALS[0]], neutral)[0]
        a.progress = b.progress = ((t - course.startT) % 1 + 1) % 1
        a.lane = b.lane = lane
        stepRacer(a, 1 / 60, 5, course)
        stepRacer(b, 1 / 60, 5, neutral)
        assert(Math.abs(a.speed / b.speed - 1.25) < 1e-10, 'Current must boost every lane by 25%')
      }
    }
    assert.equal(course.currentAt(zone.from - .00001), 1)
    assert.equal(course.currentAt(zone.to + .00001), 1)
  }
  for (const old of COURSES.slice(0, 3)) {
    for (let i = 0; i < 100; i++) assert.equal(old.currentAt(i / 100), 1, 'Original track pace changed')
  }
  console.log('PASS: currents boost all lanes by exactly 25%, repeat each lap, and end at their exit gates; original tracks unchanged.')

  for (const lane of [-1, 1]) {
    const racers = createRacers(RIVALS, course, RIVALS[0].id)
    racers[0].lane = lane
    let elapsed = 0
    while (racers.some((racer) => racer.progress < LAP_COUNT) && elapsed < 180) {
      elapsed += 1 / 60
      for (const racer of racers) {
        if (racer.progress >= LAP_COUNT) continue
        stepRacer(racer, 1 / 60, elapsed, course)
        assert(Number.isFinite(racer.progress) && racer.speed > 0)
      }
    }
    assert(racers.every((racer) => racer.progress >= LAP_COUNT), 'Every racer must finish two laps')
    console.log(`PASS: full field finishes two laps in ${elapsed.toFixed(1)}s with player choosing ${lane < 0 ? 'left' : 'right'} forks.`)
  }
} finally {
  await server.close()
}
