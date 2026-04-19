# RightCall — C4 architecture (PlantUML)

## Output

- **`RightCall-C4-Companion.pdf`** — **four pages:** (1) system context, (2) containers, (3) intelligence stack (LightGBM, SHAP+LLM, OR-Tools, forecasting, anomalies, NL layer), (4) deployment.

Source diagrams for the companion are the **four** `.puml` files listed in `scripts/render-c4-pdf.sh` (`ORDER` array).

## Regenerate

Needs **Java 17+**, **Graphviz**, **rsvg-convert**, **pdfunite**, **curl**.

```bash
npm run docs:c4-pdf
```

PlantUML JAR is downloaded to `tools/plantuml/plantuml.jar` (gitignored). Intermediates in `docs/architecture/c4/build/` (gitignored).

## Scope

Diagrams describe the **RightCall production platform** (risk, explainability, optimization, forecasting, anomalies, NL assistant). The **Git repo** today ships the **operations SPA**, **Convex starter**, **offline training scripts**, and **deterministic demo simulation** for UI playback; extend Convex and services to match this reference architecture.
