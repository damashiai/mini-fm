# Contributing to MiniFM

First off, thanks for taking the time to contribute!

## How to Contribute

1.  **Fork the repository** on GitHub.
2.  **Clone the project** to your own machine.
3.  **Create a branch** for your feature or bug fix.
    ```bash
    git checkout -b feature/amazing-feature
    ```
4.  **Commit your changes** to your own branch.
    ```bash
    git commit -m "Add some amazing feature"
    ```
5.  **Push your work** back up to your fork.
    ```bash
    git push origin feature/amazing-feature
    ```
6.  **Submit a Pull Request** so that we can review your changes.

## Development Guidelines

* **Code Style:** TypeScript + Next.js App Router. Run `npm run typecheck` before submitting.
* **Dependencies:** If you add a new library, please update `package.json` (`npm install --save <pkg>`).
* **Testing:** Ensure `npm run build` passes and playback, mood mixes, and admin upload work end-to-end before submitting.
* **Metadata:** enrichment is MusicBrainz (keyless) + Cover Art Archive. Respect their policy: descriptive User-Agent (already set) and ~1 req/sec (already throttled in `lib/musicbrainz.ts`). No scraping, no extra metadata vendors without discussion.
