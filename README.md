# Six Ball Showdown v3

A mobile-first, real-time two-player cricket duel built with Node.js, Express and Socket.IO. Each player bats for six **legal** balls and bowls six legal balls. Wides and no-balls add extras and must be rebowled.

## v3 highlights

- Two-player room codes with reconnect support
- Animated coin toss deciding the first batter
- Six selectable player kit colours
- Animated bowler run-up, batter, bat, ball, pitch and stumps
- Delivery-specific ball movement
- Proper aerial arc for sixes
- Animated fielding catch sequence
- Different wicket presentations for **bowled, LBW and caught**
- Wides and no-balls with realistic legal-ball handling
- Cinematic FOUR / SIX / WICKET / EXTRA overlays
- Replay button for the most recent delivery
- Generated Web Audio sound effects for bat, ball, wickets, boundaries, crowd-style cheers, extras and toss
- Live scoreboard with wickets and extras
- Ball-by-ball commentary and target tracking
- PWA manifest and mobile app icon
- Production health endpoint and basic security response headers

## Gameplay

1. Player one creates a room and shares the five-character code.
2. Player two joins from another phone.
3. The animated coin toss randomly decides who bats first.
4. The bowler selects one bowling archetype for the whole innings.
5. For every delivery, the bowler secretly locks a delivery while the batter secretly locks batting intent and shot direction.
6. The server resolves the delivery and both phones receive the same animated outcome.
7. After six legal balls the roles reverse.
8. Highest score after both innings wins.

### Bowling archetypes

- Fast / Pace
- Swing
- Seam
- Off Spin
- Leg Spin

### Batting intents

- Defensive
- Safe
- Aggressive
- Unorthodox

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`. For two-phone testing on the same network, open the computer's LAN IP and port 3000 on each phone and allow the port through the host firewall.

## Test

```bash
npm test
```

The tests cover bowling options, normal scoring, wides, no-balls and dismissal types.

## Deploy to Render

A `render.yaml` is included.

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/health`
- Recommended Node version: 22

The app does not require a database for casual party/classroom play. Rooms live in server memory and abandoned rooms are cleaned up automatically. Restarting the server clears active matches.

## GitHub

The whole project can be committed as-is. Do not commit `node_modules`; it is already excluded by `.gitignore`.

## Sound

All sound effects are synthesized locally in the browser with the Web Audio API. There are no external sound files or music assets. Mobile browsers require a user interaction before audio can start, so sound becomes available after the player taps a game control. A mute button is included in the header.
