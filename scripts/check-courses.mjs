/*
 * Every course, walked in every racing lane down every route it offers.
 *
 * The forked island shipped with two faults this would have caught: branches
 * that left the road at a sharp angle, and roads that met at a seam a racer
 * jumped across. Both are invisible in a screenshot and obvious in numbers, so
 * they are checked here rather than by eye.
 *
 * Run with: npm run check
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const SAMPLES = 3000
const LANES = [-1.05, 0, 1.05]
/** A step bigger than this at 3000 samples is a seam, not a corner. */
const MAX_STEP = .25
/** Roughly 17 degrees between samples; the old fork arcs turned 30 at once. */
const MAX_TURN = .3

// Nothing here renders, so skip dependency pre-bundling: it only races the
// shutdown below and prints a scan failure over the results.
const server = await createServer({
  server: { middlewareMode: true }, appType: 'custom',
  optimizeDeps: { noDiscovery: true }, logLevel: 'silent',
})
let failures = 0
try {
  const { COURSES } = await server.ssrLoadModule('/src/race/course.ts')
  assert(COURSES.length > 0, 'No courses built')

  for (const course of COURSES) {
    const { id } = course.def
    const routes = course.splits.length
      ? Array.from({ length: 2 ** course.splits.length }, (_, mask) =>
        course.splits.map((_, index) => (mask >> index) & 1))
      : [[]]

    let worstStep = 0, worstTurn = 0, minY = Infinity
    for (const route of routes) {
      for (const lane of LANES) {
        let previous = course.frameAt(0, lane, route)
        for (let i = 1; i <= SAMPLES; i++) {
          const frame = course.frameAt(i / SAMPLES, lane, route)
          const finite = [frame.position.x, frame.position.y, frame.position.z, frame.heading].every(Number.isFinite)
          assert(finite, `${id}: track frame is not a number at ${(i / SAMPLES).toFixed(3)}`)
          worstStep = Math.max(worstStep, frame.position.distanceTo(previous.position))
          let turn = Math.abs(frame.heading - previous.heading) % (Math.PI * 2)
          if (turn > Math.PI) turn = Math.PI * 2 - turn
          worstTurn = Math.max(worstTurn, turn)
          minY = Math.min(minY, frame.position.y)
          previous = frame
        }
      }
    }

    // Both ways round a fork have to be the same distance, or the choice is
    // about length rather than about which ground suits your dinosaur.
    for (const split of course.splits) {
      const [a, b] = split.branches.map((branch) => branch.getLength())
      assert(Math.abs(a - b) < 1e-6, `${id}: fork "${split.label}" is ${Math.abs(a - b).toFixed(4)} longer one way`)
      assert(split.label.includes(' or '), `${id}: fork "${split.label}" needs an "A or B" label for its signposts`)
    }

    const share = course.mix.reduce((sum, entry) => sum + entry.share, 0)
    assert(Math.abs(share - 100) <= 1, `${id}: terrain mix adds to ${share}%`)

    try {
      assert(worstStep < MAX_STEP, `${id}: racers jump ${worstStep.toFixed(3)} at a road seam`)
      assert(worstTurn < MAX_TURN, `${id}: road turns ${(worstTurn * 180 / Math.PI).toFixed(1)}° between samples`)
      assert(minY > 0, `${id}: road drops to ${minY.toFixed(3)}, below the ground`)
      console.log(`PASS ${id.padEnd(8)} ${routes.length} route(s), ${course.splits.length} fork(s) · worst step ${worstStep.toFixed(3)} · sharpest turn ${(worstTurn * 180 / Math.PI).toFixed(1)}°`)
    } catch (error) {
      failures++
      console.error(`FAIL ${error.message}`)
    }
  }
} finally {
  await server.close()
}
if (failures) process.exit(1)
console.log('All courses continuous in every lane, on every route.')
