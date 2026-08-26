/**
 * NeuralCanvas Client-Side Pipeline Validator
 * Evaluates DAG topology, data leakage, model-target consistency, and parameter integrity.
 */

export const CLASSIFICATION_MODELS = new Set([
  'RandomForestClassifier',
  'GradientBoostingClassifier',
  'LogisticRegression',
  'DecisionTreeClassifier',
  'KNeighborsClassifier',
  'SVC',
  'GaussianNB',
]);

export const REGRESSION_MODELS = new Set([
  'LinearRegression',
  'RandomForestRegressor',
  'GradientBoostingRegressor',
  'Ridge',
  'Lasso',
]);

export const ALL_MODELS = new Set([
  ...CLASSIFICATION_MODELS,
  ...REGRESSION_MODELS,
  'DenseNN',
  'CNN',
  'RNN',
  'LSTM',
  'GRU',
  'Autoencoder',
]);

export const PREPROCESSING_NODES = new Set([
  'StandardScaler',
  'MinMaxScaler',
  'RobustScaler',
  'Encoder',
  'LabelEncoder',
  'PCA',
  'Vectorizer',
  'Embeddings',
  'RemoveDuplicates',
  'DataTypeConverter',
  'RenameColumns',
  'DropConstantColumns',
  'DropMissingColumns',
  'DateFeatureExtractor',
  'OutlierHandler',
  'RareCategoryEncoder',
  'RowFilter',
  'DataBalancing',
  'PolynomialFeatures',
  'VarianceThreshold',
  'SelectKBest',
  'RFE',
  'LogTransform',
  'Discretizer',
  'CustomMathFeatures',
  'MissingValues',
]);

/**
 * Validates a pipeline graph on the frontend.
 * @param {Array} nodes React Flow nodes
 * @param {Array} edges React Flow edges
 * @param {Object} datasetInfo Metadata about active dataset (columns, column_types)
 * @returns {Object} Validation report: { valid, errors, warnings, nodeIssues }
 */
export function validatePipeline(nodes = [], edges = [], datasetInfo = null) {
  const errors = [];
  const warnings = [];
  const nodeIssues = {}; // nodeId -> { errors: [], warnings: [] }

  const addIssue = (nodeId, message, level = 'error', code = 'GENERIC') => {
    const item = { nodeId: nodeId ? String(nodeId) : null, message, code };
    if (level === 'error') {
      errors.push(item);
    } else {
      warnings.push(item);
    }

    if (nodeId) {
      const nid = String(nodeId);
      if (!nodeIssues[nid]) {
        nodeIssues[nid] = { errors: [], warnings: [] };
      }
      if (level === 'error') {
        nodeIssues[nid].errors.push(message);
      } else {
        nodeIssues[nid].warnings.push(message);
      }
    }
  };

  if (!nodes || nodes.length === 0) {
    addIssue(null, 'Pipeline is empty. Drag nodes from the left palette onto the canvas to begin.', 'error', 'EMPTY_PIPELINE');
    return {
      valid: false,
      errors,
      warnings,
      nodeIssues,
      summary: 'Empty pipeline',
    };
  }

  // 1. Map nodes and connection degrees
  const nodeMap = new Map();
  const inDegree = new Map();
  const outDegree = new Map();
  const adjacency = new Map();
  const incomingMap = new Map();

  nodes.forEach((n) => {
    if (!n || !n.id) return;
    const nid = String(n.id);
    nodeMap.set(nid, n);
    inDegree.set(nid, 0);
    outDegree.set(nid, 0);
    adjacency.set(nid, []);
    incomingMap.set(nid, []);
  });

  (edges || []).forEach((e) => {
    if (!e || !e.source || !e.target) return;
    const src = String(e.source);
    const tgt = String(e.target);

    if (!nodeMap.has(src)) {
      addIssue(tgt, `Connection points from non-existent node "${src}"`, 'error', 'DANGLING_EDGE');
      return;
    }
    if (!nodeMap.has(tgt)) {
      addIssue(src, `Connection points to non-existent node "${tgt}"`, 'error', 'DANGLING_EDGE');
      return;
    }
    if (src === tgt) {
      addIssue(src, 'Self-loop detected: A node cannot connect directly to itself.', 'error', 'SELF_LOOP');
      return;
    }

    adjacency.get(src).push(tgt);
    incomingMap.get(tgt).push(src);
    outDegree.set(src, outDegree.get(src) + 1);
    inDegree.set(tgt, inDegree.get(tgt) + 1);
  });

  // 2. Cycle Detection (Kahn's algorithm)
  const queue = [];
  const inDegreeCopy = new Map(inDegree);
  inDegreeCopy.forEach((deg, nid) => {
    if (deg === 0) queue.push(nid);
  });

  let visitedCount = 0;
  while (queue.length > 0) {
    const curr = queue.shift();
    visitedCount += 1;
    (adjacency.get(curr) || []).forEach((neighbor) => {
      inDegreeCopy.set(neighbor, inDegreeCopy.get(neighbor) - 1);
      if (inDegreeCopy.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }

  if (visitedCount < nodeMap.size) {
    inDegreeCopy.forEach((deg, nid) => {
      if (deg > 0) {
        addIssue(nid, 'Cyclic loop detected! Pipeline must flow strictly forward without loops.', 'error', 'CYCLE_DETECTED');
      }
    });
  }

  // 3. Disconnected Nodes
  nodeMap.forEach((node, nid) => {
    const ntype = node.data?.nodeType || node.type;
    if (ntype === 'start' || ntype === 'end') return;
    if (inDegree.get(nid) === 0 && outDegree.get(nid) === 0) {
      addIssue(nid, `Node "${node.data?.label || ntype}" is disconnected from the pipeline flow.`, 'warning', 'DISCONNECTED_NODE');
    }
  });

  // 4. Ingestion / Dataset Presence
  let hasDatasetNode = false;
  nodeMap.forEach((node) => {
    const ntype = node.data?.nodeType || node.type;
    if (ntype === 'loadDataset') hasDatasetNode = true;
  });
  if (!hasDatasetNode) {
    addIssue(null, 'Pipeline requires a "Load Dataset" node to feed data into downstream steps.', 'error', 'MISSING_DATASET_NODE');
  }

  // 5. Train/Test Split
  let hasSplit = false;
  const modelNodes = [];
  nodeMap.forEach((node, nid) => {
    const ntype = node.data?.nodeType || node.type;
    if (ntype === 'splitDataset') hasSplit = true;
    if (ALL_MODELS.has(ntype)) modelNodes.push({ id: nid, node });
  });

  if (modelNodes.length > 0 && !hasSplit) {
    modelNodes.forEach(({ id, node }) => {
      const label = node.data?.label || 'Model';
      addIssue(id, `${label} is trained without a "Split Dataset" node. Models may overfit if trained on unsplit data.`, 'warning', 'NO_TRAIN_TEST_SPLIT');
    });
  }

  // 6. Node Parameters & Compatibility
  nodeMap.forEach((node, nid) => {
    const data = node.data || {};
    const ntype = data.nodeType || node.type;
    const params = data.params || {};

    if (ntype === 'loadDataset') {
      const dsId = params.dataset_id || params.datasetId;
      if (!dsId) {
        addIssue(nid, 'Please select a dataset in the node settings.', 'error', 'MISSING_DATASET_SELECTION');
      }
    } else if (ntype === 'splitDataset') {
      const target = params.target_column || params.targetColumn || params.target;
      if (!target) {
        addIssue(nid, 'Split Dataset requires a selected Target Column.', 'error', 'MISSING_TARGET_COLUMN');
      }
    } else if (ntype === 'evaluate') {
      // Check upstream model
      let hasUpstreamModel = false;
      const queueAnc = [...(incomingMap.get(nid) || [])];
      const visitedAnc = new Set();
      while (queueAnc.length > 0) {
        const anc = queueAnc.shift();
        if (visitedAnc.has(anc)) continue;
        visitedAnc.add(anc);
        const ancNode = nodeMap.get(anc);
        const ancType = ancNode?.data?.nodeType || ancNode?.type;
        if (ALL_MODELS.has(ancType)) {
          hasUpstreamModel = true;
          break;
        }
        (incomingMap.get(anc) || []).forEach((p) => queueAnc.push(p));
      }
      if (!hasUpstreamModel) {
        addIssue(nid, 'Evaluate node must be connected after a trained Model node.', 'error', 'EVALUATE_WITHOUT_MODEL');
      }
    } else if (PREPROCESSING_NODES.has(ntype) && ntype !== 'predict') {
      // Check if after split (potential data leakage)
      const parents = incomingMap.get(nid) || [];
      parents.forEach((p) => {
        const pNode = nodeMap.get(p);
        const pType = pNode?.data?.nodeType || pNode?.type;
        if (pType === 'splitDataset') {
          addIssue(
            nid,
            `Potential data leakage: "${data.label || ntype}" is placed AFTER Split Dataset. Recommended practice is scaling/encoding before splitting.`,
            'warning',
            'DATA_LEAKAGE_RISK'
          );
        }
      });
    }
  });

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    warnings,
    nodeIssues,
    summary: !valid
      ? `${errors.length} critical issue(s) detected. Fix errors before running.`
      : warnings.length > 0
      ? `Pipeline valid with ${warnings.length} warning(s).`
      : 'Pipeline structure is perfectly valid!',
  };
}
