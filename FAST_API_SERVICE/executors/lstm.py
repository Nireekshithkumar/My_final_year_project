# executors/lstm.py
PARAM_SCHEMA = {
    "units": {"type": "number", "default": 64, "min": 1, "max": 1024},
    "activation": {"type": "select", "options": ["relu", "tanh", "sigmoid"], "default": "tanh"},
    "dropout": {"type": "number", "default": 0.2, "min": 0, "max": 1, "step": 0.01},
    "return_sequences": {"type": "boolean", "default": False},
}