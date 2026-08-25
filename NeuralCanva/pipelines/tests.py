import os
from unittest.mock import patch, MagicMock
import httpx
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.conf import settings
from .models import Pipeline, Graph
from .task import execute_graph, broadcast
from .cache import make_graph_cache_key, get_cached_result, set_cached_result, invalidate_graph_cache
from .preprocessing_helpers import (
    run_split_dataset,
    resolve_target_column,
    validate_and_sort_graph,
    execute_single_node
)

User = get_user_model()


class RedisConfigurationTests(TestCase):
    def test_redis_url_loads_from_env_or_setting(self):
        """Test 1: REDIS_URL loads correctly."""
        self.assertTrue(bool(settings.REDIS_URL))
        self.assertTrue(settings.REDIS_URL.startswith("redis://") or settings.REDIS_URL.startswith("rediss://"))

    def test_production_requires_redis_url(self):
        """Test 2: Production environment strictly requires REDIS_URL."""
        # When DEBUG is False and REDIS_URL is empty, raising RuntimeError is the expected contract
        with patch.dict(os.environ, {"REDIS_URL": ""}, clear=True):
            with self.assertRaises(RuntimeError):
                redis_url = os.getenv("REDIS_URL")
                debug_mode = False
                if not redis_url:
                    if not debug_mode:
                        raise RuntimeError("REDIS_URL is not configured for production.")


from common.data_utils import (
    normalize_dataframe_columns,
    resolve_target_column as sanitize_target_name,
    TargetColumnNotFoundError,
    DuplicateColumnsError,
)
from common.storage import StorageAbstraction
from datasets.models import Dataset
from django.core.files.uploadedfile import SimpleUploadedFile
import pandas as pd
import io


class ColumnNormalizationAndTargetMismatchTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='colnormuser',
            email='colnorm@example.com',
            password='testpassword123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_whitespace_column_normalization(self):
        """Test: normalize_dataframe_columns strips leading and trailing spaces from headers."""
        raw_cols = [
            'Area', ' Date', 'Region', ' Frequency', ' Estimated Employed',
            ' Estimated Unemployment Rate (%)', ' Estimated Labour Participation Rate (%)'
        ]
        data = {col: [f"val_{i}" for i in range(10)] for col in raw_cols}
        df = pd.DataFrame(data)

        normalized_df = normalize_dataframe_columns(df)
        expected_cols = [
            'Area', 'Date', 'Region', 'Frequency', 'Estimated Employed',
            'Estimated Unemployment Rate (%)', 'Estimated Labour Participation Rate (%)'
        ]
        self.assertEqual(list(normalized_df.columns), expected_cols)
        self.assertIn('Estimated Labour Participation Rate (%)', normalized_df.columns)
        # Data values must remain untouched
        self.assertEqual(normalized_df['Area'].iloc[0], 'val_0')

    def test_duplicate_headers_after_normalization_raises_error(self):
        """Test: Duplicate column names created after stripping whitespace raises DuplicateColumnsError."""
        dup_data = {
            ' Col': [1, 2, 3],
            'Col ': [4, 5, 6],
            ' Other ': [7, 8, 9]
        }
        df = pd.DataFrame(dup_data)
        with self.assertRaises(DuplicateColumnsError) as ctx:
            normalize_dataframe_columns(df)
        self.assertIn("Duplicate column names detected after sanitization", str(ctx.exception))
        self.assertEqual(ctx.exception.error_code, "DUPLICATE_COLUMNS_DETECTED")
        self.assertIn("Col", ctx.exception.duplicate_columns)

    def test_split_dataset_with_whitespace_headers_and_target(self):
        """Test: splitDataset recognizes ' Estimated Labour Participation Rate (%)' when target is given."""
        raw_input = {
            "dataframe": {
                'Area': ['Rural', 'Urban'] * 5,
                ' Date': ['2020-01-01'] * 10,
                'Region': ['North'] * 10,
                ' Frequency': ['Monthly'] * 10,
                ' Estimated Employed': [100, 200] * 5,
                ' Estimated Unemployment Rate (%)': [5.5, 6.2] * 5,
                ' Estimated Labour Participation Rate (%)': [45.1, 46.2, 44.8, 47.0, 45.9, 46.1, 45.0, 46.5, 45.3, 46.8]
            }
        }
        # 1. Target supplied with leading whitespace (matches stripped header)
        res, dropped, train_len, test_len, cols = run_split_dataset(
            raw_input,
            {"target_column": " Estimated Labour Participation Rate (%)", "test_size": 0.2}
        )
        self.assertEqual(res["target_column"], "Estimated Labour Participation Rate (%)")
        self.assertEqual(train_len, 8)
        self.assertEqual(test_len, 2)
        # cols are the normalized feature columns — target must NOT appear in them
        self.assertNotIn("Estimated Labour Participation Rate (%)", cols)
        # All returned feature columns must be stripped
        for c in cols:
            self.assertEqual(c, c.strip(), f"Column '{c}' still has whitespace")

        # 2. Target supplied without leading whitespace
        res2, dropped2, train_len2, test_len2, cols2 = run_split_dataset(
            raw_input,
            {"target_column": "Estimated Labour Participation Rate (%)", "test_size": 0.2}
        )
        self.assertEqual(res2["target_column"], "Estimated Labour Participation Rate (%)")
        self.assertNotIn("Estimated Labour Participation Rate (%)", cols2)

    def test_target_column_not_found_structured_error(self):
        """Test: TargetColumnNotFoundError provides structured error dictionary."""
        raw_input = {
            "dataframe": {
                ' Feature1': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                ' Feature2 ': [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            }
        }
        with self.assertRaises(TargetColumnNotFoundError) as ctx:
            run_split_dataset(raw_input, {"target_column": " NonExistentTarget "})

        err = ctx.exception
        self.assertEqual(err.error_code, "TARGET_COLUMN_NOT_FOUND")
        self.assertEqual(err.target_column, "NonExistentTarget")
        self.assertEqual(err.available_columns, ["Feature1", "Feature2"])
        err_dict = err.to_dict()
        self.assertEqual(err_dict["error"], "TARGET_COLUMN_NOT_FOUND")
        self.assertEqual(err_dict["message"], "Target column 'NonExistentTarget' was not found.")
        self.assertEqual(err_dict["available_columns"], ["Feature1", "Feature2"])

    def test_storage_abstraction_csv_and_excel_normalization(self):
        """Test: StorageAbstraction normalizes headers for both CSV and Excel."""
        # 1. CSV test
        csv_content = b" Area, Date, Estimated Labour Participation Rate (%)\nRural,2020-01-01,45.5\nUrban,2020-01-02,46.2\n"
        csv_file = SimpleUploadedFile("test_labour.csv", csv_content, content_type="text/csv")
        ds_csv = Dataset.objects.create(owner=self.user, name="test_labour.csv", file=csv_file)

        df_csv = StorageAbstraction.read_dataset_df(ds_csv)
        self.assertEqual(list(df_csv.columns), ["Area", "Date", "Estimated Labour Participation Rate (%)"])

        # 2. Excel test
        excel_buffer = io.BytesIO()
        df_to_excel = pd.DataFrame({
            " Region ": ["East", "West"],
            " Estimated Employed ": [500, 600]
        })
        with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
            df_to_excel.to_excel(writer, index=False)
        excel_file = SimpleUploadedFile("test_data.xlsx", excel_buffer.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        ds_excel = Dataset.objects.create(owner=self.user, name="test_data.xlsx", file=excel_file)

        df_excel = StorageAbstraction.read_dataset_df(ds_excel)
        self.assertEqual(list(df_excel.columns), ["Region", "Estimated Employed"])


class SplitDatasetNodeTests(TestCase):
    def setUp(self):
        self.sample_input = {
            "dataframe": {
                "feature_a": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
                "feature_b": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                "target": [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
            }
        }

    def test_split_dataset_rejects_missing_target(self):
        """Test 3: Split Dataset rejects missing target with clear message."""
        with self.assertRaises(ValueError) as ctx:
            run_split_dataset(self.sample_input, {})
        self.assertIn("Split Dataset requires a target column", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx2:
            run_split_dataset(self.sample_input, {"target_column": ""})
        self.assertIn("Split Dataset requires a target column", str(ctx2.exception))

    def test_split_dataset_rejects_invalid_target(self):
        """Test 4: Split Dataset rejects nonexistent target column with list of available columns."""
        with self.assertRaises(TargetColumnNotFoundError) as ctx:
            run_split_dataset(self.sample_input, {"target_column": "non_existent_column"})
        self.assertIn("Target column 'non_existent_column' was not found", str(ctx.exception))
        self.assertEqual(ctx.exception.error_code, "TARGET_COLUMN_NOT_FOUND")
        self.assertEqual(ctx.exception.available_columns, ["feature_a", "feature_b", "target"])

    def test_split_dataset_succeeds_with_valid_target_and_aliases(self):
        """Test 5: Split Dataset succeeds with valid target and supports aliases."""
        for key in ["target_column", "targetColumn", "target", "label_column", "label"]:
            res, dropped, train_len, test_len, cols = run_split_dataset(
                self.sample_input,
                {key: "target", "test_size": 0.2}
            )
            self.assertIn("X_train", res)
            self.assertIn("X_test", res)
            self.assertIn("y_train", res)
            self.assertIn("y_test", res)
            self.assertEqual(train_len, 8)
            self.assertEqual(test_len, 2)
            self.assertEqual(cols, ["feature_a", "feature_b"])
            self.assertEqual(res["target_column"], "target")


class GraphValidationAndExecutionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='graphtestuser',
            email='graph@example.com',
            password='testpassword123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.pipeline = Pipeline.objects.create(
            owner=self.user,
            name="Lifecycle Pipeline"
        )
        self.graph = Graph.objects.create(
            pipeline=self.pipeline,
            nodes=[
                {"id": "node_1", "type": "taskNode", "data": {"title": "Start", "nodeType": "start"}},
                {"id": "node_2", "type": "taskNode", "data": {"title": "End", "nodeType": "end"}}
            ],
            edges=[
                {"source": "node_1", "target": "node_2"}
            ]
        )

    def test_pipeline_status_changes_to_success_on_valid_graph(self):
        """Test 6: Pipeline status transitions to success upon completing valid graph."""
        execute_graph(self.graph.id)
        self.graph.refresh_from_db()
        self.assertEqual(self.graph.status, 'success')
        self.assertEqual(self.graph.error, '')
        self.assertIn('node_1', self.graph.node_outputs)
        self.assertIn('node_2', self.graph.node_outputs)

    def test_pipeline_status_changes_to_failed_on_broken_graph(self):
        """Test 7: Pipeline status transitions to failed on broken node."""
        self.graph.nodes = [
            {"id": "node_1", "type": "taskNode", "data": {"title": "Load", "nodeType": "loadDataset", "datasetId": 999999}}
        ]
        self.graph.edges = []
        self.graph.save()

        execute_graph(self.graph.id)
        self.graph.refresh_from_db()
        self.assertEqual(self.graph.status, 'failed')
        self.assertTrue(len(self.graph.error) > 0)
        self.assertIn("999999", self.graph.error)

    def test_pipeline_does_not_remain_in_running_on_exception(self):
        """Test 8: Exceptions in execution never leave the graph stuck in running."""
        self.graph.status = 'running'
        self.graph.nodes = [
            {"id": "node_1", "type": "taskNode", "data": {"title": "Split", "nodeType": "splitDataset"}}
        ]
        self.graph.edges = []
        self.graph.save()

        execute_graph(self.graph.id)
        self.graph.refresh_from_db()
        self.assertEqual(self.graph.status, 'failed')
        self.assertNotEqual(self.graph.status, 'running')

    def test_broadcast_failure_does_not_crash_pipeline_execution(self):
        """Test 9: WebSocket broadcast failure is safely caught and does not crash pipeline."""
        with patch("channels.layers.get_channel_layer") as mock_layer:
            mock_layer.side_effect = Exception("Redis connection refused")
            broadcast(self.pipeline.id, "Test message", stage="test", percent=50)

    def test_cycle_in_graph_is_rejected(self):
        """Test 13: Cycles in the graph are detected and rejected."""
        nodes = [
            {"id": "a", "data": {"nodeType": "start"}},
            {"id": "b", "data": {"nodeType": "end"}}
        ]
        edges = [
            {"source": "a", "target": "b"},
            {"source": "b", "target": "a"}
        ]
        with self.assertRaises(ValueError) as ctx:
            validate_and_sort_graph(nodes, edges)
        self.assertIn("cycle", str(ctx.exception).lower())

    def test_missing_node_referenced_by_edge_is_rejected(self):
        """Test 14: Edges referencing missing nodes are rejected with helpful message."""
        nodes = [{"id": "node_1", "data": {"nodeType": "start"}}]
        edges = [{"source": "node_1", "target": "missing_node_2"}]
        with self.assertRaises(ValueError) as ctx:
            validate_and_sort_graph(nodes, edges)
        self.assertIn("missing_node_2", str(ctx.exception))

    def test_fastapi_failure_does_not_leave_pipeline_stuck_in_running(self):
        """Test 15: FastAPI HTTP / connection errors transition pipeline to failed."""
        self.graph.nodes = [
            {"id": "ds_1", "type": "taskNode", "data": {"title": "Load", "nodeType": "loadDataset"}},
            {"id": "sp_1", "type": "taskNode", "data": {"title": "Split", "nodeType": "splitDataset", "params": {"target": "target"}}},
            {"id": "ml_1", "type": "taskNode", "data": {"title": "Random Forest", "nodeType": "RandomForestClassifier"}}
        ]
        self.graph.edges = [
            {"source": "ds_1", "target": "sp_1"},
            {"source": "sp_1", "target": "ml_1"}
        ]
        self.graph.save()

        with patch("pipelines.preprocessing_helpers._http_client.post") as mock_post:
            mock_post.side_effect = httpx.ConnectError("Connection refused to FastAPI service")
            execute_graph(self.graph.id)

        self.graph.refresh_from_db()
        self.assertEqual(self.graph.status, 'failed')
        self.assertTrue(len(self.graph.error) > 0)


class NodeRunAndPreviewEndpointTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='nodeuser',
            email='nodeuser@example.com',
            password='testpassword123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.pipeline = Pipeline.objects.create(
            owner=self.user,
            name="Node Endpoint Pipeline"
        )
        self.graph = Graph.objects.create(
            pipeline=self.pipeline,
            nodes=[
                {"id": "node_1", "type": "taskNode", "data": {"title": "Start", "nodeType": "start"}},
                {"id": "node_2", "type": "taskNode", "data": {"title": "Split", "nodeType": "splitDataset", "params": {"target_column": "target"}}}
            ],
            edges=[
                {"source": "node_1", "target": "node_2"}
            ]
        )

    def test_preview_returns_preview_after_successful_run(self):
        """Test 10: Preview endpoint returns structured data when output is cached."""
        self.graph.node_outputs = {
            "node_1": {
                "dataframe": {
                    "feature_a": [1.0, 2.0, 3.0, 4.0],
                    "feature_b": ["x", "y", "x", "y"]
                },
                "columns": ["feature_a", "feature_b"]
            }
        }
        self.graph.save()

        response = self.client.get(f"/api/pipelines/{self.pipeline.id}/nodes/node_1/preview/?page=1&page_size=10")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['node_id'], 'node_1')
        self.assertEqual(data['total_rows'], 4)
        self.assertEqual(data['columns'], ["feature_a", "feature_b"])
        self.assertEqual(len(data['rows']), 4)

    def test_preview_returns_404_with_helpful_message_when_no_cached_output(self):
        """Test 11: Preview endpoint returns 404 with helpful message when no cached output exists."""
        response = self.client.get(f"/api/pipelines/{self.pipeline.id}/nodes/preview/")
        self.assertEqual(response.status_code, 404)
        self.assertIn("No node output cached yet", response.json().get('detail', ''))

    def test_invalid_node_run_returns_structured_error(self):
        """Test 12: Running a node with missing dependencies returns structured error JSON."""
        response = self.client.post(f"/api/pipelines/{self.pipeline.id}/nodes/node_2/run/")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)
        self.assertIn("node_id", data)
        self.assertIn("node_type", data)
        self.assertIn("errors", data)
        self.assertEqual(data['node_id'], 'node_2')
        self.assertEqual(data['node_type'], 'splitDataset')
        self.assertTrue(len(data['errors']) > 0)


class CacheManagementTests(TestCase):
    def test_cache_key_and_invalidation(self):
        user_id = 1
        nodes = [{"id": "1"}]
        edges = []
        result = {"accuracy": 0.95}

        set_cached_result(user_id, nodes, edges, result)
        cached = get_cached_result(user_id, nodes, edges)
        self.assertEqual(cached, result)

        invalidate_graph_cache(user_id, nodes, edges)
        self.assertIsNone(get_cached_result(user_id, nodes, edges))
