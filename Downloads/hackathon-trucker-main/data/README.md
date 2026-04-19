# ELD Risk Mock Data

This folder holds the first-pass dataset for experimenting with freight risk scoring.

Files:

- `eld_risk_feature_catalog.csv`: feature dictionary with provenance for each field.
- `eld_risk_training_mock.csv`: synthetic driver snapshots for model exploration and baseline training.

Notes:

- The mock dataset is intentionally honest about source boundaries. Standard FMCSA ELD data gives us timestamps, location, engine hours, vehicle miles, driver and vehicle identity, and duty-status context. It does not guarantee weather, traffic, road class, fuel level, tire pressure, brake health, or fault-code detail.
- A practical production pipeline would join location and time to external weather, traffic, and map data, then blend that with telematics and maintenance feeds for vehicle condition.
- `risk_score`, `risk_band`, and `risk_event_next_2h` are synthetic labels generated from a transparent ruleset so we have something to model against before we accumulate real interventions and outcomes.
- The generator now defaults to `10,000` rows, with a broader driver and vehicle roster so the model sees more entity diversity.

Useful real-world source starting points:

- FMCSA ELD overview and functions FAQs for what a compliant ELD actually records.
- National Weather Service API or another historical weather API for weather joins.
- OpenStreetMap road classifications for map matching and road-type enrichment.
- A traffic provider or state 511 feed for congestion context.

Regenerate the CSVs with:

```sh
npm run generate:eld-risk-data
```

Generate an even larger dataset:

```sh
npm run generate:eld-risk-data -- 25000
```

Train the baseline Python models:

```sh
npm run train:eld-risk-model
```
