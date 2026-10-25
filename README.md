# Gloop Gloop

A squishy physics merge game. Launch gloops from the floating row, merge matching numbers into bigger ones, and don't let the goo max out both pressure pads.

Inspired by sobosuba. Not affiliated with sobosuba or its developer.

## Playing
Open `index.html` in a browser, or visit the deployed site. On a phone, use "Add to Home Screen" for a full-screen app.

Saves and the best score are kept in each player's own browser.

## Deploying
It is a static site with no build step: Vercel serves the files as they are.

## Leaderboard
The global leaderboard runs on a small Vercel function (`api/leaderboard.js`) that stores scores in Upstash Redis.
To turn it on: in the Vercel project open **Storage**, create an **Upstash for Redis** database (the free plan is plenty) and connect it to this project, then redeploy.
Until that's connected, the game still works and the leaderboard simply says it isn't set up yet.
