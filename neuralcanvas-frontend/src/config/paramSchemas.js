// src/config/paramSchemas.js
export const PARAM_SCHEMAS = {
  splitDataset: [
    { name: "target_column", label: "Target Column", type: "select", options: [], default: "" },
    { name: "test_size", label: "Test Size", type: "select", options: ["0.5", "0.3", "0.25", "0.2", "0.1"], default: "0.2" },
  ],

  StandardScaler: [
    { name: "columns", label: "Columns to Scale", type: "multiselect", options: [], default: [] },
  ],

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
    { name: "n_estimators", label: "N Estimators", type: "number", default: 100 },
    { name: "max_depth", label: "Max Depth", type: "number", default: null, placeholder: "auto / none" },
    { name: "criterion", label: "Criterion", type: "select", options: ["gini", "entropy", "log_loss"], default: "gini" },
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
    { name: "units", label: "Units", type: "number", default: 64 },
    { name: "activation", label: "Activation", type: "select", options: ["tanh", "relu", "sigmoid"], default: "tanh" },
    { name: "dropout", label: "Dropout", type: "number", default: 0.2 },
    { name: "return_sequences", label: "Return Sequences", type: "boolean", default: false },
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

  SaveModel: [
    { name: "format", label: "Format", type: "select", options: ["pkl", "h5"], default: "pkl" },
    { name: "filename", label: "Filename", type: "text", default: "model" },
  ],
  predict: [
  { name: "mode", label: "Prediction Source", type: "select", options: ["test_split", "custom"], default: "test_split" },
  { name: "feature_values", label: "Feature Values", type: "feature_inputs", default: {} },
],

Encoder: [
  { name: "method", label: "Encoding Method", type: "select", options: ["OneHot", "Label", "Ordinal", "Target"], default: "OneHot" },
  { name: "features", label: "Features to Encode", type: "multiselect", allowedTypes: ["categorical", "text"], options: [], default: [] },
  { name: "target_column", label: "Target Column (Target Enc.)", type: "select", options: [], default: "" },
],

Vectorizer: [
  { name: "method", label: "Vectorization Method", type: "select", options: ["TF-IDF", "CountVectorizer"], default: "TF-IDF" },
  { name: "features", label: "Text Features", type: "multiselect", allowedTypes: ["text"], options: [], default: [] },
  { name: "max_features", label: "Max Features / Vocab", type: "number", default: 100 },
],

StandardScaler: [
  { name: "apply_all", label: "Apply to All Numerical Features", type: "boolean", default: true },
  { name: "columns", label: "Columns to Scale", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
],

MinMaxScaler: [
  { name: "apply_all", label: "Apply to All Numerical Features", type: "boolean", default: true },
  { name: "columns", label: "Columns to Scale", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
  { name: "feature_range_min", label: "Range Min", type: "number", default: 0 },
  { name: "feature_range_max", label: "Range Max", type: "number", default: 1 },
],

RobustScaler: [
  { name: "apply_all", label: "Apply to All Numerical Features", type: "boolean", default: true },
  { name: "columns", label: "Columns to Scale", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
],

MaxAbsScaler: [
  { name: "apply_all", label: "Apply to All Numerical Features", type: "boolean", default: true },
  { name: "columns", label: "Columns to Scale", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
],
  Normalizer: [
    { name: "apply_all", label: "Apply to All Numerical Features", type: "boolean", default: true },
    { name: "columns", label: "Columns to Scale", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
  ],

  HyperparamTuning: [
    { name: "algorithm", label: "Target Algorithm", type: "select", options: ["RandomForestClassifier", "LogisticRegression", "SVC", "DecisionTreeClassifier"], default: "RandomForestClassifier" },
    { name: "search_method", label: "Search Strategy", type: "select", options: ["GridSearch", "RandomSearch"], default: "GridSearch" },
    { name: "cv_folds", label: "Cross-Validation Folds", type: "number", default: 5 },
    { name: "param_grid", label: "Parameter Grid (JSON string)", type: "text", default: '{"n_estimators": [10, 50], "max_depth": [3, 5]}' },
  ],

  // ── Advanced Data Cleaning Nodes ──
  RemoveDuplicates: [
    { name: "keep", label: "Keep Strategy", type: "select", options: ["first", "last", "none"], default: "first" },
    { name: "subset", label: "Columns to Check (leave empty for all)", type: "multiselect", options: [], default: [] },
  ],

  DataTypeConverter: [
    { name: "column", label: "Target Column", type: "select", options: [], default: "" },
    { name: "target_type", label: "Cast To Type", type: "select", options: ["float", "int", "str", "datetime", "category", "bool"], default: "float" },
    { name: "type_mapping", label: "Custom Mapping JSON (optional)", type: "text", default: "" },
  ],

  RenameColumns: [
    { name: "old_name", label: "Original Column", type: "select", options: [], default: "" },
    { name: "new_name", label: "New Column Name", type: "text", default: "" },
    { name: "rename_mapping", label: "Bulk JSON Mapping (optional)", type: "text", default: "" },
  ],

  DropConstantColumns: [
    { name: "threshold", label: "Max Allowed Unique Values", type: "number", default: 1 },
  ],

  DropMissingColumns: [
    { name: "threshold", label: "Max Missing Ratio (0.0 to 1.0)", type: "number", default: 0.5 },
  ],

  OutlierHandler: [
    { name: "columns", label: "Columns to Clean", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
    { name: "method", label: "Outlier Detection Method", type: "select", options: ["IQR", "ZScore"], default: "IQR" },
    { name: "action", label: "Treatment Action", type: "select", options: ["clip", "remove", "impute_median"], default: "clip" },
    { name: "threshold", label: "Threshold (IQR multiplier / Z-score)", type: "number", default: 1.5 },
  ],

  RareCategoryEncoder: [
    { name: "columns", label: "Categorical Columns", type: "multiselect", allowedTypes: ["categorical"], options: [], default: [] },
    { name: "threshold", label: "Min Frequency Ratio (e.g. 0.02 = 2%)", type: "number", default: 0.02 },
    { name: "replacement_label", label: "Replacement Label", type: "text", default: "Other" },
  ],

  RowFilter: [
    { name: "column", label: "Filter Column", type: "select", options: [], default: "" },
    { name: "operator", label: "Operator", type: "select", options: ["==", "!=", ">", ">=", "<", "<=", "contains", "not_null", "is_null"], default: "==" },
    { name: "value", label: "Comparison Value", type: "text", default: "" },
  ],

  DataBalancing: [
    { name: "target_column", label: "Target Class Column", type: "select", options: [], default: "" },
    { name: "method", label: "Balancing Algorithm", type: "select", options: ["SMOTE", "RandomOverSampler", "RandomUnderSampler"], default: "SMOTE" },
    { name: "random_state", label: "Random Seed", type: "number", default: 42 },
  ],

  // ── Advanced Feature Engineering Nodes ──
  PolynomialFeatures: [
    { name: "columns", label: "Numerical Columns", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
    { name: "degree", label: "Polynomial Degree", type: "number", default: 2 },
    { name: "interaction_only", label: "Interaction Only (No Powers)", type: "boolean", default: false },
    { name: "include_bias", label: "Include Bias Term", type: "boolean", default: false },
  ],

  VarianceThreshold: [
    { name: "threshold", label: "Min Variance Threshold", type: "number", default: 0.0 },
  ],

  SelectKBest: [
    { name: "target_column", label: "Target Column", type: "select", options: [], default: "" },
    { name: "k", label: "Number of Top Features (k)", type: "number", default: 5 },
    { name: "score_func", label: "Score Metric", type: "select", options: ["f_classif", "f_regression"], default: "f_classif" },
  ],

  RFE: [
    { name: "target_column", label: "Target Column", type: "select", options: [], default: "" },
    { name: "n_features_to_select", label: "Features to Select", type: "number", default: 5 },
    { name: "task_type", label: "Task Type", type: "select", options: ["classification", "regression"], default: "classification" },
  ],

  LogTransform: [
    { name: "columns", label: "Columns to Transform", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
    { name: "method", label: "Transformation", type: "select", options: ["log1p", "sqrt"], default: "log1p" },
  ],

  Discretizer: [
    { name: "columns", label: "Numerical Columns", type: "multiselect", allowedTypes: ["numerical"], options: [], default: [] },
    { name: "n_bins", label: "Number of Bins", type: "number", default: 5 },
    { name: "strategy", label: "Binning Strategy", type: "select", options: ["quantile", "uniform", "kmeans"], default: "quantile" },
  ],

  CustomMathFeatures: [
    { name: "new_column_name", label: "New Feature Name", type: "text", default: "custom_feature" },
    { name: "formula", label: "Math Formula (e.g. colA * 2 + colB)", type: "text", default: "" },
  ],

  // ── AutoML & Hyperparameter Optimization ──
  AutoML: [
    { name: "task_type", label: "Task Type", type: "select", options: ["auto", "classification", "regression"], default: "auto" },
    { name: "cv_folds", label: "Cross-Validation Folds", type: "number", default: 3 },
    { name: "scoring_metric", label: "Optimization Metric", type: "select", options: ["f1", "accuracy", "r2", "rmse"], default: "f1" },
  ],

  ModelComparison: [
    {
      name: "algorithms",
      label: "Algorithms to Benchmark",
      type: "multiselect",
      options: [
        "RandomForestClassifier",
        "GradientBoostingClassifier",
        "LogisticRegression",
        "DecisionTreeClassifier",
        "SVC",
        "KNeighborsClassifier",
        "ExtraTreesClassifier",
        "GaussianNB",
        "LinearRegression",
        "RandomForestRegressor",
        "GradientBoostingRegressor",
        "Ridge",
        "Lasso"
      ],
      default: ["RandomForestClassifier", "LogisticRegression", "DecisionTreeClassifier"]
    },
  ],

  HyperparamTuning: [
    {
      name: "base_algo",
      label: "Base Estimator",
      type: "select",
      options: [
        "RandomForestClassifier",
        "GradientBoostingClassifier",
        "LogisticRegression",
        "DecisionTreeClassifier",
        "SVC",
        "RandomForestRegressor",
        "GradientBoostingRegressor",
        "Ridge"
      ],
      default: "RandomForestClassifier"
    },
    { name: "search_method", label: "Search Strategy", type: "select", options: ["GridSearch", "RandomSearch"], default: "GridSearch" },
    { name: "cv_folds", label: "CV Folds", type: "number", default: 3 },
  ],
};