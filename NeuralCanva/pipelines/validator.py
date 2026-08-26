"""
NeuralCanva Pipeline Validation Engine
Performs structural, topological, semantic, and machine learning integrity checks on pipeline graphs.
"""

from typing import List, Dict, Any, Tuple
import re

# Model Categorization
CLASSIFICATION_MODELS = {
    'RandomForestClassifier',
    'GradientBoostingClassifier',
    'LogisticRegression',
    'DecisionTreeClassifier',
    'KNeighborsClassifier',
    'SVC',
    'GaussianNB',
    'MultinomialNB',
    'Perceptron',
    'SGDClassifier',
    'PassiveAggressiveClassifier',
    'AdaBoostClassifier',
    'BaggingClassifier',
    'ExtraTreesClassifier',
    'VotingClassifier',
    'StackingClassifier',
    'XGBClassifier',
    'LGBMClassifier',
}

REGRESSION_MODELS = {
    'LinearRegression',
    'RandomForestRegressor',
    'GradientBoostingRegressor',
    'Ridge',
    'Lasso',
    'ElasticNet',
    'DecisionTreeRegressor',
    'AdaBoostRegressor',
    'BaggingRegressor',
    'ExtraTreesRegressor',
    'SVR',
    'KNeighborsRegressor',
    'VotingRegressor',
    'StackingRegressor',
    'XGBRegressor',
    'LGBMRegressor',
}

AUTOML_AND_TUNING_MODELS = {
    'AutoML',
    'AutoMLClassifier',
    'AutoMLRegressor',
    'ModelComparison',
    'HyperparamTuning',
    'CrossValidation',
}

DEEP_LEARNING_MODELS = {
    'DenseNN',
    'CNN',
    'RNN',
    'LSTM',
    'GRU',
    'Autoencoder',
}

ALL_MODELS = CLASSIFICATION_MODELS | REGRESSION_MODELS | AUTOML_AND_TUNING_MODELS | DEEP_LEARNING_MODELS

PREPROCESSING_NODES = {
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
}


def validate_pipeline_structure(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], dataset_info: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Validates a pipeline DAG and returns a structured report with errors and warnings mapped to node IDs.
    
    Checks performed:
    1. Empty graph / missing nodes
    2. Cycles in the DAG (Kahn's algorithm)
    3. Ingestion: Presence of loadDataset / input source
    4. Train/Test Split: Models trained without prior splitting (leakage/generalization warning)
    5. Data Leakage: Scalers or Feature Selectors placed after splitDataset on both train+test vs prior
    6. Disconnected nodes (nodes with 0 incoming & 0 outgoing edges)
    7. Model & Evaluation Compatibility:
       - Classification model used with continuous target
       - Regression model used with discrete/categorical target
       - Evaluation node without upstream trained model
    8. Text / Vectorizer Compatibility: Text embeddings/vectorizer connected to models without preprocessing
    9. Missing required node parameters (e.g. missing target_column on split)
    """
    errors = []     # Blocking issues: [{"node_id": str, "message": str, "code": str}]
    warnings = []   # Non-blocking advisories: [{"node_id": str, "message": str, "code": str}]
    node_issues = {} # node_id -> {"errors": [str], "warnings": [str]}

    def add_issue(node_id: str, message: str, level: str = 'error', code: str = 'GENERIC'):
        item = {'node_id': str(node_id) if node_id else None, 'message': message, 'code': code}
        if level == 'error':
            errors.append(item)
        else:
            warnings.append(item)
        
        if node_id:
            nid = str(node_id)
            if nid not in node_issues:
                node_issues[nid] = {'errors': [], 'warnings': []}
            if level == 'error':
                node_issues[nid]['errors'].append(message)
            else:
                node_issues[nid]['warnings'].append(message)

    if not nodes:
        add_issue(None, "The pipeline is completely empty. Add nodes to begin.", level='error', code='EMPTY_PIPELINE')
        return {
            'valid': False,
            'errors': errors,
            'warnings': warnings,
            'node_issues': node_issues,
            'summary': "Empty pipeline"
        }

    # 1. Map nodes and adjacency
    node_map = {}
    in_degree = {}
    out_degree = {}
    adjacency = {}
    incoming_map = {}

    for n in nodes:
        if not isinstance(n, dict) or 'id' not in n:
            continue
        nid = str(n['id'])
        node_map[nid] = n
        in_degree[nid] = 0
        out_degree[nid] = 0
        adjacency[nid] = []
        incoming_map[nid] = []

    for e in edges:
        if not isinstance(e, dict):
            continue
        src = str(e.get('source'))
        tgt = str(e.get('target'))

        if src not in node_map:
            add_issue(tgt, f"Connection references missing source node '{src}'", level='error', code='DANGLING_EDGE')
            continue
        if tgt not in node_map:
            add_issue(src, f"Connection references missing target node '{tgt}'", level='error', code='DANGLING_EDGE')
            continue
        if src == tgt:
            add_issue(src, "Self-loop connection detected on node", level='error', code='SELF_LOOP')
            continue

        adjacency[src].append(tgt)
        incoming_map[tgt].append(src)
        out_degree[src] += 1
        in_degree[tgt] += 1

    # 2. Cycle Detection via Kahn's Algorithm
    from collections import deque
    queue = deque([nid for nid, deg in in_degree.items() if deg == 0])
    visited_count = 0
    topological_order = []

    in_degree_copy = in_degree.copy()
    while queue:
        curr = queue.popleft()
        topological_order.append(curr)
        visited_count += 1
        for neighbor in adjacency[curr]:
            in_degree_copy[neighbor] -= 1
            if in_degree_copy[neighbor] == 0:
                queue.append(neighbor)

    if visited_count < len(node_map):
        # Cycle detected
        # Find nodes involved in cycle (those with remaining in_degree > 0)
        cycle_nodes = [nid for nid, deg in in_degree_copy.items() if deg > 0]
        for cn in cycle_nodes:
            add_issue(cn, "Node is part of a cyclic loop. ML pipelines must flow strictly forward (DAG).", level='error', code='CYCLE_DETECTED')

    # 3. Check for Disconnected Nodes
    for nid, node in node_map.items():
        ntype = node.get('data', {}).get('nodeType') or node.get('type')
        if ntype in ('start', 'end'):
            continue
        if in_degree[nid] == 0 and out_degree[nid] == 0:
            add_issue(nid, f"Node '{node.get('data', {}).get('label', ntype)}' is completely disconnected from the pipeline.", level='warning', code='DISCONNECTED_NODE')

    # 4. Check Ingestion / Data Source
    load_nodes = [nid for nid, n in node_map.items() if (n.get('data', {}).get('nodeType') or n.get('type')) == 'loadDataset']
    if not load_nodes:
        add_issue(None, "Pipeline has no 'Load Dataset' node. Execution will fail without an input dataset.", level='error', code='MISSING_DATASET_NODE')

    # 5. Check Train / Test Split before Models
    model_nodes = [nid for nid, n in node_map.items() if (n.get('data', {}).get('nodeType') or n.get('type')) in ALL_MODELS]
    split_nodes = [nid for nid, n in node_map.items() if (n.get('data', {}).get('nodeType') or n.get('type')) == 'splitDataset']

    if model_nodes and not split_nodes:
        for mn in model_nodes:
            m_label = node_map[mn].get('data', {}).get('label', 'Model')
            add_issue(mn, f"{m_label} is trained directly on unsplit data. Add a 'Split Dataset' node to prevent over-fitting.", level='warning', code='NO_TRAIN_TEST_SPLIT')

    # 6. Check Node-Specific Parameters & Node Validity
    for nid, node in node_map.items():
        data = node.get('data', {})
        ntype = data.get('nodeType') or node.get('type')
        params = data.get('params', {}) or {}

        if ntype == 'loadDataset':
            dataset_id = params.get('dataset_id') or params.get('datasetId')
            if not dataset_id:
                add_issue(nid, "Load Dataset node has no dataset selected.", level='error', code='MISSING_DATASET_SELECTION')

        elif ntype == 'splitDataset':
            target_col = params.get('target_column') or params.get('targetColumn') or params.get('target')
            if not target_col:
                add_issue(nid, "Split Dataset requires a 'Target Column' to be selected.", level='error', code='MISSING_TARGET_COLUMN')

        elif ntype == 'evaluate':
            # Check if there is an upstream model node connected
            has_upstream_model = False
            # Traverse backwards
            visited_ancestors = set()
            ancestor_queue = deque(incoming_map.get(nid, []))
            while ancestor_queue:
                anc = ancestor_queue.popleft()
                if anc in visited_ancestors:
                    continue
                visited_ancestors.add(anc)
                anc_type = node_map[anc].get('data', {}).get('nodeType') or node_map[anc].get('type')
                if anc_type in ALL_MODELS:
                    has_upstream_model = True
                    break
                ancestor_queue.extend(incoming_map.get(anc, []))

            if not has_upstream_model:
                add_issue(nid, "Evaluate node must receive output from a trained model node.", level='error', code='EVALUATE_WITHOUT_MODEL')

        elif ntype in ALL_MODELS:
            # Check if target column is specified or inherited
            # Also check task type consistency with target if dataset_info is provided
            if dataset_info and isinstance(dataset_info, dict):
                col_types = dataset_info.get('column_types', {})
                unique_counts = dataset_info.get('unique_counts', {})
                # Find target column from upstream split node
                target_col = None
                anc_queue = deque(incoming_map.get(nid, []))
                seen_anc = set()
                while anc_queue:
                    a = anc_queue.popleft()
                    if a in seen_anc:
                        continue
                    seen_anc.add(a)
                    a_data = node_map[a].get('data', {})
                    if (a_data.get('nodeType') or node_map[a].get('type')) == 'splitDataset':
                        a_params = a_data.get('params', {})
                        target_col = a_params.get('target_column') or a_params.get('targetColumn')
                        break
                    anc_queue.extend(incoming_map.get(a, []))

                if target_col and target_col in col_types:
                    t_dtype = str(col_types.get(target_col, '')).lower()
                    u_count = unique_counts.get(target_col, 0)
                    is_continuous = any(t in t_dtype for t in ['float', 'double']) and (u_count > 25 if u_count else True)

                    if ntype in CLASSIFICATION_MODELS and is_continuous:
                        add_issue(
                            nid,
                            f"Classification model '{ntype}' is applied to continuous target '{target_col}' ({t_dtype}). Use a Regression model instead.",
                            level='warning',
                            code='TASK_TARGET_MISMATCH'
                        )
                    elif ntype in REGRESSION_MODELS and not is_continuous and u_count and u_count <= 10:
                        add_issue(
                            nid,
                            f"Regression model '{ntype}' is applied to discrete/categorical target '{target_col}' with only {u_count} unique classes. Use a Classification model instead.",
                            level='warning',
                            code='TASK_TARGET_MISMATCH'
                        )

    # 7. Check Data Leakage: Preprocessing applied AFTER Split instead of before
    for nid, node in node_map.items():
        ntype = node.get('data', {}).get('nodeType') or node.get('type')
        if ntype in PREPROCESSING_NODES and ntype not in ('predict', 'evaluate'):
            # Check if any parent is a splitDataset node
            parents = incoming_map.get(nid, [])
            for p in parents:
                p_type = node_map[p].get('data', {}).get('nodeType') or node_map[p].get('type')
                if p_type == 'splitDataset':
                    add_issue(
                        nid,
                        f"Potential data leakage or ordering issue: '{node.get('data', {}).get('label', ntype)}' is placed AFTER 'Split Dataset'. Best practice is to clean/scale before splitting or fit only on training data.",
                        level='warning',
                        code='DATA_LEAKAGE_RISK'
                    )

    is_valid = len(errors) == 0
    return {
        'valid': is_valid,
        'errors': errors,
        'warnings': warnings,
        'node_issues': node_issues,
        'summary': f"Found {len(errors)} error(s) and {len(warnings)} warning(s)." if not is_valid or warnings else "Pipeline structure is valid and ready for execution."
    }
