# Welcome to Offerly

This is a job search command center that runs entirely on your own computer —
your résumé, your data, and everything it finds stays on your machine. Nothing
is uploaded anywhere.

## What you need first

**Node.js** (a free developer tool this app runs on). If you're not sure
whether you have it, open Terminal and type `node -v` — if you see a version
number, you're set. If not, get it free at **https://nodejs.org** (the
"LTS" button) and install it like any other app, then come back here.

**An AI tool.** Offerly runs on an AI assistant you already use — it'll ask
which one on the very first screen and tell you exactly what to install if
you don't have it yet. Free options exist if you don't want to set up a paid
one just to try this out.

## Where to put it

Move the zip out of Downloads first — into your **Documents** folder or your
home folder. Once this is running, your résumé, profile, and every tailored
PDF it generates live *inside this folder*, so it's worth putting somewhere
you'll keep, not somewhere that gets cleared out. Unzip it there.

## How to start it

1. Unzip this folder if you haven't already (see above for where).
2. Open **Terminal** (Mac) — search for "Terminal" in Spotlight (⌘+Space).
3. Drag the unzipped folder into the Terminal window (this fills in the path
   for you), then press Enter to `cd` into it. Or type `cd ` (with a space)
   then drag the folder in.
4. Run:
   ```bash
   ./start.sh
   ```
5. The first run takes a minute or two (it's installing what it needs). Your
   browser will open automatically when it's ready.
6. Follow the setup screens — they'll walk you through everything: which AI
   you use, your résumé, what roles you're looking for, and where to search.

## Using it again later

Once it's set up, just run `./start.sh` again any time — it remembers
everything from last time and skips straight to your dashboard.

## If something breaks

There's a "Report a bug" button in the bottom-left corner of the app once
it's running — describe what happened and your own AI will investigate and
fix it, right there. Or just tell whoever sent you this and they can take a
look.

## Windows

Double-click **`start.bat`** in this folder (or right-click → Open). It
checks for Node.js and installs it automatically if it's missing or too old,
then sets everything up and opens your browser when it's ready — same
one-step experience as Mac's `./start.sh`. If it says it installed Node but
can't see it yet, close the window, run `start.bat` again, and it'll pick up
from there (Windows needs a fresh terminal to notice a new install).
