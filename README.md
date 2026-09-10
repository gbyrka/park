# Park

A silent, top-down 2D parking game for your browser. No dependencies or build step.

## Play

- Arrow Up / Down: accelerate forward / brake and reverse.
- Arrow Left / Right: steer while moving.
- R: restart (discards the unfinished round).

Move the whole car into the green bay and stop to earn a point. Classic mode lasts 60 seconds. You can enter an occupied bay, but hitting the actual vehicle or a curb blocks movement.

## Scores

The header shows your best completed-round score for the current mode. Expand **Score history** below the game to see the 20 latest completed rounds, newest first.

The `park_scores_v1` cookie stores versioned JSON: `version`, `history` (entries with `mode`, `score`, and `at` as a Unix timestamp in milliseconds), and `bestByMode`. The current mode identifier is `classic-60s`; future modes can keep separate records. The best score is preserved even when older history entries are removed. Completed zero-point rounds are saved too.

The cookie expires one year after the latest save. Scores stay in this browser and can be lost if cookies are cleared. Blocked cookies do not prevent playing; a message explains when scores cannot be persisted.

## Run

Serve this folder over HTTP or HTTPS (cookies are unreliable with `file://`). For example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. You can also host the files on GitHub Pages.
