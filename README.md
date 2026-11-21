# Taehyung and Yeontan: Desktop Pet

A tiny Taehyung and Yeontan who walk along the bottom of your screen, on top of your windows. Fan-made, free, no VS Code needed.

## Download

Go to the [Releases page](https://github.com/tipandtale/taehyungyeontan-desktop/releases/latest) and download the file for your computer:

- **Mac:** the `.dmg` file (`arm64` for M1/M2/M3/M4 Macs, `x64` for older Intel Macs)
- **Windows:** the `.exe` file
- **Linux:** the `.AppImage` file

### Mac: first time opening

The app isn't signed with a paid Apple developer account, so macOS will warn you. It's safe to open, here's how:

1. Open the `.dmg` and drag the app into Applications.
2. In Applications, **right-click** the app and choose **Open**, then click **Open** again.
3. If it says the app is "damaged" or won't open, go to **System Settings, Privacy & Security**, scroll down, and click **Open Anyway**. Or run this in Terminal and try again:
   `xattr -cr "/Applications/Taehyung and Yeontan.app"`

### Windows: first time opening

Windows may show a blue "Windows protected your PC" screen. Click **More info**, then **Run anyway**.

## What they do

- **Walk** back and forth along the bottom of your screen, sometimes pausing, turning or running.
- **Nap** after 2 minutes of no mouse or keyboard activity, and wake when you're back.
- **Click** them: they hop and say a quote.
- **Drag** them anywhere. They get worried and fall back down when you let go.
- **Focus timer**: click the tray / menu bar icon, then "Start 25-minute focus".
- They never block what's under them, only the pet itself is clickable.

The tray / menu bar icon also has: hide/show, nap, size (small/medium/large), launch at login, quit.

## Run from source

Needs [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm start
```

## Licenses

Code is MIT. The artwork in `assets/` is not, see `assets/LICENSE-ART.md`.

---

Fan-made with love by tipandtale. Not affiliated with or endorsed by BTS, HYBE, or any of the members.
