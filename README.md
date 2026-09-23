# PARK — Find your space.

A silent, top-down parking game with a landscaped parking lot, detailed cars, and precise driving. Runs directly in the browser, with no production dependencies or build step.

## Play

- **Up / Down:** accelerate forward / brake and reverse. Pressing the opposite direction brakes before driving the other way.
- **Left / Right:** steer. The wheels turn at rest; the car turns only when moving.
- **Space:** brake in either direction. Hold to stay stopped, even if an arrow pedal is pressed. Space never engages reverse and does not scroll the page during play.
- **Escape** or **Options / pause:** pause and open the menu. Escape or **Resume drive** resumes the same round.
- **R:** restart, discarding the unfinished round.

Park completely inside the highlighted green bay and stay still for 0.75 seconds. Each successful park earns one point and selects another unoccupied bay. The bay label, dashboard guidance, and progress bar help you line up and stop. Both forward and reverse parking count.

**Classic** lasts 60 seconds. **Car + trailer** lasts 180 seconds and requires both bodies to fit inside the longer bay. Drive forward to straighten an angled trailer; reverse slowly with small steering corrections. The dashboard warns when the trailer is sharply angled.

The game automatically pauses when you leave the tab or window, or after a long interrupted frame. No time is lost while paused. Changing the challenge in the pause menu applies to a new round; resuming retains the original mode and position.

## Handling and feedback

Physics runs at a fixed 120 Hz, independently of the screen's refresh rate. A bicycle steering model pivots the car around its rear axle, with gradual steering input and self-centring wheels. Acceleration, rolling resistance, slower reverse, and a heavier trailer make low-speed manoeuvres controllable. Space has priority over the accelerator.

Rotated collision bodies prevent cars and the trailer from passing through curbs, landscaping, each other, or parked vehicles. Impacts stop movement without bouncing the rig across the map. Reverse gently to get clear. Painted markings and wheel-stop stripes are decorative and drivable.

Brake lights on the car and trailer respond to Space and opposite-direction braking. Reverse lights, moving front wheels, a speedometer, and a gear indicator show what the car is doing. The speedometer uses a compact-car scale of roughly 4.5 metres per car length.

The end-of-round card shows parks without a bump, significant bumps, and the quickest park. Bumps do not subtract points. Targets cycle through a shuffled set of empty bays before repeating, with no immediate repeat.

## Scores and preferences

Existing scores remain compatible. The `park_scores_v1` cookie stores versioned JSON: `version`, `history` (up to 20 entries with `mode`, `score`, and `at` as a Unix timestamp in milliseconds), and `bestByMode`. Mode identifiers remain `classic-60s` and `trailer-180s`. The best score is preserved even when older history entries are removed. Completed zero-point rounds are saved too; interrupted rounds are not.

The cookie expires one year after the latest save. Scores stay in this browser and can be lost if cookies are cleared. Blocked cookies do not prevent playing; a message explains when scores are kept for the current session only.

The optional `park_preferences_v1` local-storage entry remembers the chosen colour and challenge. The trailer is always white.

## Run and publish

Serve this entire folder over HTTP or HTTPS. Cookies are unreliable with `file://`.

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765. For GitHub Pages, publish `index.html`, `style.css`, `game.js`, **`physics.js`**, **`scene.js`**, and the `assets` folder together. No build is needed. Google Analytics uses the shared games stream `G-WTPHWDLQ7K`.

## Development checks

Run the dependency-free physics tests with Node.js:

```sh
node tests/physics.cjs
```

The suite covers braking in both directions and both modes, pedal priority, reverse steering, coasting, collision recovery, trailer drawbar stability, and complete containment in every usable bay.

With Playwright and Chromium installed in your development environment, start the local server and run:

```sh
node tests/browser.cjs
```

`PARK_URL` overrides the server URL. Set `PARK_SCREENSHOT_DIR` to a directory to capture the menu, gameplay, trailer, results, and responsive layouts. Browser checks cover actual keyboard input, scoring, pause/resume, legacy cookies, storage failures, keyboard focus, small screens, and JavaScript errors. Analytics requests are blocked in these checks.

## Artwork and accessibility

All parking-lot and vehicle artwork is drawn locally in Canvas. The detailed static background is cached; display-density scaling keeps the board crisp. The full board fits proportionally in its frame. Menus scroll internally in short windows, with a keyboard focus loop and visible focus states. Reduced-motion preferences disable pulsing goals and celebration rings.

The MoD-IT logo links to Grzegorz Byrka on LinkedIn. The original artwork is displayed with CSS colour inversion and blending for the dark theme. Keep the original image in `assets` when publishing.
