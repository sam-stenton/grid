# The Grid

Classroom games for GCSE, A level and Further Maths, played on the projector and on students' phones.

Students join at `https://YOUR-USERNAME.github.io/grid/join`.

## What's in here

| File | What it does |
|---|---|
| `index.html` | The Grid on the projector: all the games, the team scoreboard and the **📱 Live** button. |
| `join.html` | The page students open on their phones. The short link is `/join`. |
| `test.html` | A connection check. Open it on a student phone on the college Wi-Fi to confirm live play works there. |
| `js/firebase-config.js` | Your Firebase settings. Paste them in once. These values aren't secret. |
| `js/live.js` | The live connection layer. All games talk to Firebase through this file. |
| `database.rules.json` | The security rules. Paste them into Firebase → Realtime Database → Rules. |

## How live play works

1. The teacher clicks **📱 Live** on the projector and gets a 4-letter code and a QR code.
2. Students open `…/join`, type the code and their first name, and tap Join. No accounts are needed: each phone signs in anonymously.
3. The projector lists everyone who has joined. The teacher can remove anyone with ✕.
4. When the session ends, the room is wiped from the database.

The rules stop a phone from writing anything except its own name and score. Once a game locks, phones can't change their cards either, so changing the page can't be used to cheat.

## Data

Firebase stores only what a game needs: a first name, a score and, for some games, a card. Rooms are deleted when a session ends, and any left over are reused after 12 hours. The database runs in Belgium (europe-west1).
