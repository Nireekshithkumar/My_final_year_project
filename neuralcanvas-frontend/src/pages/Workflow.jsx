import { useState, useCallback } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from '../components/nodes/CustomNode';
import NodePalette from '../components/nodes/NodePalette';
import DatasetUpload from '../components/DatasetUpload';
import useStore from '../store/useStore';

const nodeTypes = { custom: CustomNode };
let idCounter = 1;

export default function Workflow() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const onConnect = useStore((s) => s.onConnect);
  const addNode = useStore((s) => s.addNode);
  const updateNodeData = useStore((s) => s.updateNodeData);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow-type');
      const label = e.dataTransfer.getData('application/reactflow-label');
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const newNode = {
        id: `${type}_${idCounter++}`,
        type: 'custom',
        position,
        data: { label, nodeType: type, configured: false },
      };

      addNode(newNode);
    },
    [reactFlowInstance, addNode]
  );

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <NodePalette />

      <div style={{ flex: 1 }} onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onInit={setReactFlowInstance}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div style={{ width: 300, borderLeft: '1px solid #e5e7eb', padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{selectedNode.data.label}</h3>

          {selectedNode.data.nodeType === 'loadDataset' && (
            <DatasetUpload
              onUploaded={(dataset) => {
                updateNodeData(selectedNode.id, {
                  datasetId: dataset.id,
                  columns: dataset.columns,
                  configured: true,
                });
              }}
            />
          )}

          {selectedNode.data.nodeType === 'trainModel' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Model Category</label>
              <select
                style={{ width: '100%', marginTop: 4, marginBottom: 12, padding: 6 }}
                value={selectedNode.data.category || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { category: e.target.value, algorithm: '' })}
              >
                <option value="">Select category</option>
                <option value="classical">Classical ML</option>
                <option value="deep_learning">Deep Learning</option>
              </select>

              {selectedNode.data.category === 'classical' && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Algorithm</label>
                  <select
                    style={{ width: '100%', marginTop: 4, marginBottom: 12, padding: 6 }}
                    value={selectedNode.data.algorithm || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { algorithm: e.target.value, configured: true })}
                  >
                    <option value="">Select algorithm</option>
                    <option value="LogisticRegression">Logistic Regression</option>
                    <option value="KNeighborsClassifier">KNN (K-Nearest Neighbors)</option>
                    <option value="DecisionTreeClassifier">Decision Tree</option>
                    <option value="RandomForestClassifier">Random Forest</option>
                    <option value="GradientBoostingClassifier">Gradient Boosting</option>
                    <option value="SVC">SVM</option>
                    <option value="GaussianNB">Naive Bayes</option>
                    <option value="LinearRegression">Linear Regression</option>
                    <option value="Ridge">Ridge Regression</option>
                  </select>
                </>
              )}

              {selectedNode.data.category === 'deep_learning' && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Architecture</label>
                  <select
                    style={{ width: '100%', marginTop: 4, marginBottom: 12, padding: 6 }}
                    value={selectedNode.data.algorithm || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { algorithm: e.target.value, configured: true })}
                  >
                    <option value="">Select architecture</option>
                    <option value="DenseNN">ANN (Dense Neural Network)</option>
                    <option value="CNN">CNN (Convolutional)</option>
                    <option value="RNN">RNN</option>
                    <option value="LSTM">LSTM</option>
                    <option value="GRU">GRU</option>
                    <option value="Autoencoder">Autoencoder</option>
                  </select>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}