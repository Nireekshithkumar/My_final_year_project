# executors/random_forest.py
PARAM_SCHEMA = {
    "n_estimators": {"type": "number", "default": 100, "min": 1},
    "max_depth": {"type": "number", "default": None, "min": 1, "nullable": True},
    "criterion": {"type": "select", "options": ["gini", "entropy", "log_loss"], "default": "gini"},
}