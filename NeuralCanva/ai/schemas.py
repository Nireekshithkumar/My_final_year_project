"""
NeuralCanva AI Pydantic Schemas
Strict structured schemas for validation and client-safe payload generation.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DatasetColumnInfo(BaseModel):
    name: str
    dtype: str
    type_category: str = Field(description="'numerical', 'categorical', 'text', 'datetime', 'boolean'")
    missing_count: int = 0
    missing_percent: float = 0.0
    unique_count: int = 0
    sample_values: List[Any] = []


class DatasetAnalysisResult(BaseModel):
    dataset_id: str
    dataset_name: str
    rows: int
    columns: int
    columns_info: List[DatasetColumnInfo] = []
    numerical_columns: List[str] = []
    categorical_columns: List[str] = []
    text_columns: List[str] = []
    missing_total: int = 0
    missing_percentage: float = 0.0
    duplicate_rows: int = 0
    possible_task: str = Field(description="'classification', 'regression', 'clustering', 'nlp'")
    possible_targets: List[str] = []
    recommended_target: Optional[str] = None
    target_class_distribution: Optional[Dict[str, int]] = None
    recommended_preprocessing: List[str] = []
    summary_markdown: str


class RecommendedModelItem(BaseModel):
    model_name: str
    algorithm_type: str = Field(description="Exact key matching NeuralCanva algorithm registry")
    category: str = Field(description="'ML' or 'DL'")
    confidence_score: float = 0.9
    reasons: List[str] = []
    default_params: Dict[str, Any] = {}
    pros: List[str] = []
    cons: List[str] = []


class ModelRecommendationResult(BaseModel):
    task_type: str
    target_column: Optional[str] = None
    top_recommendation: RecommendedModelItem
    alternative_models: List[RecommendedModelItem] = []
    evaluation_metric: str = "accuracy"
    summary_markdown: str


class PipelineNodeSpec(BaseModel):
    id: str
    node_type: str
    label: Optional[str] = None
    params: Dict[str, Any] = {}
    position: Optional[Dict[str, float]] = None


class PipelineEdgeSpec(BaseModel):
    source: str
    target: str
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None


class GeneratedPipelineSpec(BaseModel):
    pipeline_name: str = "AI Generated ML Pipeline"
    task_type: str
    target_column: Optional[str] = None
    dataset_id: Optional[str] = None
    dataset_name: Optional[str] = None
    nodes: List[PipelineNodeSpec]
    edges: List[PipelineEdgeSpec]
    explanation: str
    estimated_steps: List[str] = []


class PipelineDebugResult(BaseModel):
    pipeline_id: int
    is_healthy: bool
    failed_node_id: Optional[str] = None
    failed_node_type: Optional[str] = None
    failed_node_title: Optional[str] = None
    error_message: Optional[str] = None
    error_category: Optional[str] = None
    possible_causes: List[str] = []
    recommended_fix: str
    suggested_action: Optional[Dict[str, Any]] = None  # { action: "update_node", node_id: "...", changes: {...} }


class PipelineRepairAction(BaseModel):
    action: str = Field(description="'update_node', 'add_node', 'remove_node', 'connect_nodes'")
    node_id: Optional[str] = None
    changes: Dict[str, Any] = {}
    reason: str
    confirmed: bool = False


class NodeExplanationResult(BaseModel):
    node_type: str
    title: str
    category: str
    description: str
    how_it_works: str
    when_to_use: List[str] = []
    hyperparameters_guide: Dict[str, str] = {}
    best_practices: List[str] = []
