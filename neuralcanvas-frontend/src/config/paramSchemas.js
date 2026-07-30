// src/config/paramSchemas.js
export const PARAM_SCHEMAS = {
  StandardScaler: [],
  MinMaxScaler: [
    { name: "feature_range_min", label: "Range Min", type: "number", default: 0 },
    { name: "feature_range_max", label: "Range Max", type: "number", default: 1 },
  ],
  PCA: [
    { name: "n_components", label: "Components", type: "number", default: 2 },
  ],
  LabelEncoder: [],

  LogisticRegression: [
    { name: "C", label: "C (Regularization)", type: "number", default: 1.0 },
    { name: "max_iter", label: "Max Iterations", type: "number", default: 100 },
    { name: "penalty", label: "Penalty", type: "select", options: ["l2", "l1", "elasticnet", "none"], default: "l2" },
  ],
  KNeighborsClassifier: [
    { name: "n_neighbors", label: "Neighbors (K)", type: "number", default: 5 },
    { name: "weights", label: "Weights", type: "select", options: ["uniform", "distance"], default: "uniform" },
  ],
  DecisionTreeClassifier: [
    { name: "max_depth", label: "Max Depth", type: "number", default: null, placeholder: "unlimited" },
    { name: "criterion", label: "Criterion", type: "select", options: ["gini", "entropy", "log_loss"], default: "gini" },
  ],
  RandomForestClassifier: [
    { name: "n_estimators", label: "Trees", type: "number", default: 100 },
    { name: "max_depth", label: "Max Depth", type: "number", default: null, placeholder: "unlimited" },
  ],
  SVC: [
    { name: "C", label: "C (Regularization)", type: "number", default: 1.0 },
    { name: "kernel", label: "Kernel", type: "select", options: ["linear", "rbf", "poly", "sigmoid"], default: "rbf" },
  ],
  GaussianNB: [],
  LinearRegression: [],

  DenseNN: [
    { name: "units", label: "Units", type: "number", default: 128 },
    { name: "dropout", label: "Dropout", type: "number", default: 0.2 },
    { name: "epochs", label: "Epochs", type: "number", default: 10 },
    { name: "batch_size", label: "Batch Size", type: "number", default: 32 },
    { name: "optimizer", label: "Optimizer", type: "select", options: ["adam", "sgd", "rmsprop"], default: "adam" },
    { name: "loss", label: "Loss Function", type: "select", options: ["sparse_categorical_crossentropy", "categorical_crossentropy", "mse", "binary_crossentropy"], default: "sparse_categorical_crossentropy" },
  ],
  CNN: [
    { name: "epochs", label: "Epochs", type: "number", default: 10 },
    { name: "batch_size", label: "Batch Size", type: "number", default: 32 },
    { name: "optimizer", label: "Optimizer", type: "select", options: ["adam", "sgd", "rmsprop"], default: "adam" },
    { name: "loss", label: "Loss Function", type: "select", options: ["sparse_categorical_crossentropy", "categorical_crossentropy"], default: "sparse_categorical_crossentropy" },
  ],
  RNN: [
    { name: "units", label: "Units", type: "number", default: 128 },
    { name: "dropout", label: "Dropout", type: "number", default: 0.2 },
    { name: "epochs", label: "Epochs", type: "number", default: 10 },
    { name: "optimizer", label: "Optimizer", type: "select", options: ["adam", "sgd", "rmsprop"], default: "adam" },
  ],
  LSTM: [
    { name: "units", label: "Units", type: "number", default: 128 },
    { name: "dropout", label: "Dropout", type: "number", default: 0.2 },
    { name: "epochs", label: "Epochs", type: "number", default: 10 },
    { name: "optimizer", label: "Optimizer", type: "select", options: ["adam", "sgd", "rmsprop"], default: "adam" },
  ],
  GRU: [
    { name: "units", label: "Units", type: "number", default: 128 },
    { name: "dropout", label: "Dropout", type: "number", default: 0.2 },
    { name: "epochs", label: "Epochs", type: "number", default: 10 },
    { name: "optimizer", label: "Optimizer", type: "select", options: ["adam", "sgd", "rmsprop"], default: "adam" },
  ],
  Autoencoder: [
    { name: "units", label: "Units", type: "number", default: 128 },
    { name: "epochs", label: "Epochs", type: "number", default: 10 },
    { name: "optimizer", label: "Optimizer", type: "select", options: ["adam", "sgd"], default: "adam" },
  ],
  StandardScaler: [
  { name: "with_mean", label: "With Mean", type: "boolean", default: true },
  { name: "with_std", label: "With Std", type: "boolean", default: true },
],
RandomForestClassifier: [
  { name: "n_estimators", label: "N Estimators", type: "number", default: 100 },
  { name: "max_depth", label: "Max Depth", type: "number", default: null, placeholder: "auto / none" },
  { name: "criterion", label: "Criterion", type: "select", options: ["gini", "entropy", "log_loss"], default: "gini" },
],
LSTM: [
  { name: "units", label: "Units", type: "number", default: 64 },
  { name: "activation", label: "Activation", type: "select", options: ["tanh", "relu", "sigmoid"], default: "tanh" },
  { name: "dropout", label: "Dropout", type: "number", default: 0.2 },
  { name: "return_sequences", label: "Return Sequences", type: "boolean", default: false },
],
SaveModel: [
  { name: "format", label: "Format", type: "select", options: ["pkl", "h5"], default: "pkl" },
  { name: "filename", label: "Filename", type: "text", default: "model" },
],
};
