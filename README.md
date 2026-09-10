# Park

A silent, top-down 2D parking game for your browser. No dependencies or build step.

## Play

- Arrow Up / Down: accelerate forward / brake and reverse.
- Arrow Left / Right: steer while moving.
- Escape or Options / new game: open the setup menu.
- R: restart (discards the unfinished round).

Move the whole car into the green bay and stop to earn a point. Classic mode lasts 60 seconds. Trailer mode lasts 180 seconds and uses longer parking bays. Both car and white trailer must fit completely inside the target. You can enter an occupied bay, but hitting the actual vehicle or a curb blocks movement.

## Setup and trailer handling

Before starting, choose Classic or Car + trailer and any car colour. The trailer is always white. Drive forward to straighten the trailer; reverse slowly and make small corrections. The trailer pivots around the hitch, has its own collision body, and cannot pass through cars, curbs, or your car.

## Scores

The header shows your best completed-round score for the current mode. Expand **Score history** below the game to see the 20 latest completed rounds, newest first.

The `park_scores_v1` cookie stores versioned JSON: `version`, `history` (entries with `mode`, `score`, and `at` as a Unix timestamp in milliseconds), and `bestByMode`. Mode identifiers are `classic-60s` and `trailer-180s`; future modes can keep separate records. The best score is preserved even when older history entries are removed. Completed zero-point rounds are saved too.

The cookie expires one year after the latest save. Scores stay in this browser and can be lost if cookies are cleared. Blocked cookies do not prevent playing; a message explains when scores cannot be persisted.

## Run

Serve this folder over HTTP or HTTPS (cookies are unreliable with `file://`). For example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. You can also host the files on GitHub Pages.

## Branding

The MoD-IT logo links to Grzegorz Byrka on LinkedIn. Keep the `assets` folder when uploading the game. The original artwork is displayed with a CSS colour inversion and blending to match the dark theme.

## Window fit and brake lights

The board scales proportionally into the space left below the header and above the controls, including after resizing the window. The trailer map is 960 × 680 with a narrower central aisle; parking bays remain 198 units long. The setup menu scrolls internally in short windows.

Both the car and trailer show bright red brake lights while pressing Down during forward travel or Up while reversing. Lights dim once stopped or accelerating in the new direction.
