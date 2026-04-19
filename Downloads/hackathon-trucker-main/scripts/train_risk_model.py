#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import pickle
from pathlib import Path

import numpy as np
import pandas as pd


DEFAULT_INPUT = Path("data/eld_risk_training_mock.csv")
DEFAULT_OUTPUT_DIR = Path("artifacts/ml")
LEAKAGE_COLUMNS = {
    "row_id",
    "event_timestamp_utc",
    "trip_id",
    "scenario_id",
    "driver_id",
    "vehicle_id",
    "risk_score",
    "risk_band",
    "risk_event_next_2h",
    "intervention_recommendation",
    "primary_risk_reason",
    "secondary_risk_reason",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a baseline freight-risk model from the mock ELD dataset."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--epochs", type=int, default=800)
    parser.add_argument("--learning-rate", type=float, default=0.08)
    parser.add_argument("--l2", type=float, default=0.001)
    return parser.parse_args()


def coerce_boolish_columns(frame: pd.DataFrame) -> pd.DataFrame:
    converted = frame.copy()
    for column in converted.columns:
        series = converted[column]
        if pd.api.types.is_bool_dtype(series):
            converted[column] = series.astype(float)
            continue

        if not pd.api.types.is_object_dtype(series):
            continue

        lowered = series.dropna().astype(str).str.lower()
        if not lowered.empty and lowered.isin({"true", "false"}).all():
            converted[column] = (
                series.astype(str).str.lower().map({"true": 1.0, "false": 0.0})
            )

    return converted


def build_design_matrices(
    train_frame: pd.DataFrame, test_frame: pd.DataFrame, feature_columns: list[str]
) -> tuple[np.ndarray, np.ndarray, dict[str, object]]:
    train_features = coerce_boolish_columns(train_frame[feature_columns])
    test_features = coerce_boolish_columns(test_frame[feature_columns])

    numeric_columns = [
        column
        for column in feature_columns
        if pd.api.types.is_numeric_dtype(train_features[column])
    ]
    categorical_columns = [
        column for column in feature_columns if column not in numeric_columns
    ]

    train_parts: list[np.ndarray] = []
    test_parts: list[np.ndarray] = []
    model_feature_names: list[str] = []

    numeric_means: dict[str, float] = {}
    numeric_stds: dict[str, float] = {}
    categorical_dummy_columns: list[str] = []

    if numeric_columns:
        train_numeric = train_features[numeric_columns].astype(float)
        test_numeric = test_features[numeric_columns].astype(float)

        means = train_numeric.mean()
        stds = train_numeric.std(ddof=0).replace(0, 1.0)

        train_parts.append(((train_numeric - means) / stds).to_numpy(dtype=float))
        test_parts.append(((test_numeric - means) / stds).to_numpy(dtype=float))
        model_feature_names.extend(numeric_columns)
        numeric_means = means.to_dict()
        numeric_stds = stds.to_dict()

    if categorical_columns:
        train_categorical = pd.get_dummies(
            train_features[categorical_columns].astype("string"),
            prefix=categorical_columns,
            dtype=float,
        )
        test_categorical = pd.get_dummies(
            test_features[categorical_columns].astype("string"),
            prefix=categorical_columns,
            dtype=float,
        ).reindex(columns=train_categorical.columns, fill_value=0.0)

        train_parts.append(train_categorical.to_numpy(dtype=float))
        test_parts.append(test_categorical.to_numpy(dtype=float))
        model_feature_names.extend(train_categorical.columns.tolist())
        categorical_dummy_columns = train_categorical.columns.tolist()

    if train_parts:
        x_train = np.hstack(train_parts)
        x_test = np.hstack(test_parts)
    else:
        x_train = np.zeros((len(train_frame), 0), dtype=float)
        x_test = np.zeros((len(test_frame), 0), dtype=float)

    x_train = np.column_stack([np.ones(len(train_frame), dtype=float), x_train])
    x_test = np.column_stack([np.ones(len(test_frame), dtype=float), x_test])

    metadata = {
        "feature_columns": feature_columns,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "numeric_means": numeric_means,
        "numeric_stds": numeric_stds,
        "categorical_dummy_columns": categorical_dummy_columns,
        "model_feature_names": ["intercept", *model_feature_names],
    }
    return x_train, x_test, metadata


def sigmoid(values: np.ndarray) -> np.ndarray:
    clipped = np.clip(values, -30.0, 30.0)
    return 1.0 / (1.0 + np.exp(-clipped))


def train_logistic_regression(
    x_train: np.ndarray,
    y_train: np.ndarray,
    epochs: int,
    learning_rate: float,
    l2: float,
) -> np.ndarray:
    weights = np.zeros(x_train.shape[1], dtype=float)
    positive_count = max(float((y_train == 1).sum()), 1.0)
    negative_count = max(float((y_train == 0).sum()), 1.0)
    positive_weight = negative_count / positive_count
    sample_weights = np.where(y_train == 1, positive_weight, 1.0)

    for _ in range(epochs):
        scores = x_train @ weights
        probabilities = sigmoid(scores)
        gradient = (x_train.T @ ((probabilities - y_train) * sample_weights)) / len(
            y_train
        )
        gradient[1:] += (l2 / len(y_train)) * weights[1:]
        weights -= learning_rate * gradient

    return weights


def train_ridge_regression(
    x_train: np.ndarray, y_train: np.ndarray, l2: float
) -> np.ndarray:
    identity = np.eye(x_train.shape[1], dtype=float)
    identity[0, 0] = 0.0
    regularized = x_train.T @ x_train + (l2 * len(y_train)) * identity
    target_projection = x_train.T @ y_train
    return np.linalg.solve(regularized, target_projection)


def classify(probabilities: np.ndarray, threshold: float = 0.5) -> np.ndarray:
    return (probabilities >= threshold).astype(int)


def accuracy_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float((y_true == y_pred).mean())


def precision_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    true_positive = float(((y_true == 1) & (y_pred == 1)).sum())
    predicted_positive = float((y_pred == 1).sum())
    return true_positive / predicted_positive if predicted_positive else 0.0


def recall_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    true_positive = float(((y_true == 1) & (y_pred == 1)).sum())
    actual_positive = float((y_true == 1).sum())
    return true_positive / actual_positive if actual_positive else 0.0


def f1_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    precision = precision_score(y_true, y_pred)
    recall = recall_score(y_true, y_pred)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def log_loss(y_true: np.ndarray, probabilities: np.ndarray) -> float:
    safe_probabilities = np.clip(probabilities, 1e-9, 1 - 1e-9)
    losses = -(
        y_true * np.log(safe_probabilities)
        + (1 - y_true) * np.log(1 - safe_probabilities)
    )
    return float(losses.mean())


def roc_auc_score(y_true: np.ndarray, probabilities: np.ndarray) -> float:
    positive_count = int((y_true == 1).sum())
    negative_count = int((y_true == 0).sum())
    if positive_count == 0 or negative_count == 0:
        return float("nan")

    ranked = pd.Series(probabilities).rank(method="average").to_numpy()
    positive_rank_sum = float(ranked[y_true == 1].sum())
    return (
        positive_rank_sum - positive_count * (positive_count + 1) / 2
    ) / (positive_count * negative_count)


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def r2_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    total_variance = float(np.sum((y_true - y_true.mean()) ** 2))
    residual_variance = float(np.sum((y_true - y_pred) ** 2))
    if total_variance == 0:
        return 0.0
    return 1.0 - residual_variance / total_variance


def top_weight_summary(
    feature_names: list[str], weights: np.ndarray, limit: int = 10
) -> dict[str, list[dict[str, float | str]]]:
    coefficients = [
        {"feature": feature, "weight": float(weight)}
        for feature, weight in zip(feature_names[1:], weights[1:])
    ]
    strongest_positive = sorted(coefficients, key=lambda item: item["weight"], reverse=True)[
        :limit
    ]
    strongest_negative = sorted(coefficients, key=lambda item: item["weight"])[:limit]
    return {
        "strongest_positive": strongest_positive,
        "strongest_negative": strongest_negative,
    }


def find_best_threshold(
    y_true: np.ndarray, probabilities: np.ndarray
) -> tuple[float, float]:
    best_threshold = 0.5
    best_f1 = -1.0

    for threshold in np.linspace(0.15, 0.8, 27):
        predictions = classify(probabilities, threshold=float(threshold))
        current_f1 = f1_score(y_true, predictions)
        if current_f1 > best_f1:
            best_threshold = float(threshold)
            best_f1 = current_f1

    return best_threshold, best_f1


def round_metrics(metrics: dict[str, float]) -> dict[str, float]:
    rounded: dict[str, float] = {}
    for key, value in metrics.items():
        if math.isnan(value):
            rounded[key] = value
        else:
            rounded[key] = round(float(value), 4)
    return rounded


def main() -> None:
    args = parse_args()
    data_path = args.input
    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    frame = pd.read_csv(data_path)
    if len(frame) < 1000:
        raise ValueError(
            f"Dataset at {data_path} only has {len(frame)} rows. Generate a larger dataset before training."
        )

    feature_columns = [
        column for column in frame.columns if column not in LEAKAGE_COLUMNS
    ]

    rng = np.random.default_rng(args.seed)
    indices = np.arange(len(frame))
    rng.shuffle(indices)

    split_index = int(len(indices) * (1 - args.test_size))
    train_index = indices[:split_index]
    test_index = indices[split_index:]

    train_frame = frame.iloc[train_index].reset_index(drop=True)
    test_frame = frame.iloc[test_index].reset_index(drop=True)

    x_train, x_test, preprocessing = build_design_matrices(
        train_frame, test_frame, feature_columns
    )

    y_train_event = train_frame["risk_event_next_2h"].astype(int).to_numpy(dtype=float)
    y_test_event = test_frame["risk_event_next_2h"].astype(int).to_numpy(dtype=float)
    y_train_score = train_frame["risk_score"].to_numpy(dtype=float)
    y_test_score = test_frame["risk_score"].to_numpy(dtype=float)

    classifier_weights = train_logistic_regression(
        x_train=x_train,
        y_train=y_train_event,
        epochs=args.epochs,
        learning_rate=args.learning_rate,
        l2=args.l2,
    )
    train_classifier_probabilities = sigmoid(x_train @ classifier_weights)
    decision_threshold, train_best_f1 = find_best_threshold(
        y_train_event, train_classifier_probabilities
    )
    classifier_probabilities = sigmoid(x_test @ classifier_weights)
    classifier_predictions = classify(
        classifier_probabilities, threshold=decision_threshold
    )

    regressor_weights = train_ridge_regression(
        x_train=x_train, y_train=y_train_score, l2=args.l2
    )
    regressor_predictions = np.clip(x_test @ regressor_weights, 0.0, 100.0)

    classification_metrics = round_metrics(
        {
            "accuracy": accuracy_score(y_test_event, classifier_predictions),
            "precision": precision_score(y_test_event, classifier_predictions),
            "recall": recall_score(y_test_event, classifier_predictions),
            "f1": f1_score(y_test_event, classifier_predictions),
            "log_loss": log_loss(y_test_event, classifier_probabilities),
            "roc_auc": roc_auc_score(y_test_event, classifier_probabilities),
            "decision_threshold": decision_threshold,
            "train_best_f1": train_best_f1,
        }
    )
    regression_metrics = round_metrics(
        {
            "rmse": rmse(y_test_score, regressor_predictions),
            "mae": mae(y_test_score, regressor_predictions),
            "r2": r2_score(y_test_score, regressor_predictions),
        }
    )

    feature_names = preprocessing["model_feature_names"]
    artifact = {
        "version": 1,
        "seed": args.seed,
        "input_path": str(data_path),
        "row_count": int(len(frame)),
        "feature_count": len(feature_columns),
        "preprocessing": preprocessing,
        "classifier": {
            "target": "risk_event_next_2h",
            "decision_threshold": decision_threshold,
            "weights": classifier_weights.tolist(),
            "top_weights": top_weight_summary(feature_names, classifier_weights),
            "metrics": classification_metrics,
        },
        "regressor": {
            "target": "risk_score",
            "weights": regressor_weights.tolist(),
            "top_weights": top_weight_summary(feature_names, regressor_weights),
            "metrics": regression_metrics,
        },
    }

    metrics_payload = {
        "dataset": {
            "input_path": str(data_path),
            "row_count": int(len(frame)),
            "train_rows": int(len(train_frame)),
            "test_rows": int(len(test_frame)),
            "feature_columns": feature_columns,
        },
        "classification": classification_metrics,
        "regression": regression_metrics,
        "classifier_top_weights": artifact["classifier"]["top_weights"],
        "regressor_top_weights": artifact["regressor"]["top_weights"],
    }

    holdout_predictions = test_frame[
        ["metro_area", "road_class", "weather_condition", "traffic_level"]
    ].copy()
    holdout_predictions["actual_event"] = y_test_event.astype(int)
    holdout_predictions["predicted_event_probability"] = np.round(
        classifier_probabilities, 4
    )
    holdout_predictions["actual_risk_score"] = y_test_score.astype(float)
    holdout_predictions["predicted_risk_score"] = np.round(regressor_predictions, 2)

    artifact_path = output_dir / "risk_model_artifact.pkl"
    metrics_path = output_dir / "training_metrics.json"
    predictions_path = output_dir / "holdout_predictions.csv"

    with artifact_path.open("wb") as artifact_file:
        pickle.dump(artifact, artifact_file)

    metrics_path.write_text(json.dumps(metrics_payload, indent=2))
    holdout_predictions.to_csv(predictions_path, index=False)

    print(f"Trained baseline models from {data_path}")
    print(f"Rows: {len(frame)} | Train: {len(train_frame)} | Test: {len(test_frame)}")
    print(f"Classification metrics: {json.dumps(classification_metrics)}")
    print(f"Regression metrics: {json.dumps(regression_metrics)}")
    print(f"Saved artifact: {artifact_path}")
    print(f"Saved metrics: {metrics_path}")
    print(f"Saved holdout predictions: {predictions_path}")


if __name__ == "__main__":
    main()
