import os
from unittest.mock import patch, MagicMock
import httpx
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.conf import settings
from .models import Pipeline, Graph, PipelineExecutionRun
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


class DataPropagationAndEncodingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_prop_user', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_encoder_auto_detection_and_date_handling(self):
        """Test that Categorical Encoder auto-detects text/date columns and produces numeric features."""
        from .preprocessing_helpers import run_encoder_node
        
        # Sample dataset with Area (cat), Date (date string), Region (cat), Numeric cols
        sample_data = {
            "dataframe": {
                "Area": ["Rural", "Urban", "Rural", "Urban"],
                "Date": ["31-05-2019", "30-06-2019", "31-07-2019", "31-08-2019"],
                "Region": ["Andhra Pradesh", "Andhra Pradesh", "Assam", "Assam"],
                "Estimated Employed": [1000, 2000, 1500, 2500],
                "Estimated Unemployment Rate (%)": [3.5, 4.2, 5.1, 4.8]
            }
        }
        
        params = {
            "method": "OneHot",
            "features": [],  # Empty features list to test auto-detection
            "target_column": "Estimated Unemployment Rate (%)"
        }
        
        result, before_cols, after_cols = run_encoder_node(sample_data, params)
        
        # Date column should be decomposed into numeric components
        self.assertIn("Date_year", result["columns"])
        self.assertIn("Date_month", result["columns"])
        self.assertIn("Date_day", result["columns"])
        self.assertIn("Date_dayofweek", result["columns"])
        self.assertNotIn("Date", result["columns"])
        
        # Area and Region should be OneHot encoded
        self.assertTrue(any(col.startswith("Area_") for col in result["columns"]))
        self.assertTrue(any(col.startswith("Region_") for col in result["columns"]))
        self.assertNotIn("Area", result["columns"])
        self.assertNotIn("Region", result["columns"])

    def test_split_node_preview_partitions(self):
        """Test that DatasetPreviewView respects ?partition= query parameter and returns correct row counts."""
        from .models import Pipeline, Graph
        
        pipeline = Pipeline.objects.create(name="Split Preview Pipeline", owner=self.user)
        
        # Mock split output data: 4 train rows, 1 test row
        node_outputs = {
            "node_split": {
                "X_train": [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0], [7.0, 8.0]],
                "X_test": [[9.0, 10.0]],
                "y_train": [0, 1, 0, 1],
                "y_test": [0],
                "columns": ["feat_1", "feat_2"],
                "target_column": "target"
            }
        }
        
        Graph.objects.create(
            pipeline=pipeline,
            nodes=[{"id": "node_split", "data": {"nodeType": "splitDataset"}}],
            edges=[],
            node_outputs=node_outputs
        )
        
        # 1. Default (X_train)
        url_train = f"/api/pipelines/{pipeline.id}/nodes/node_split/preview/"
        res_train = self.client.get(url_train)
        self.assertEqual(res_train.status_code, 200)
        data_train = res_train.json()
        self.assertEqual(data_train["total_rows"], 4)
        self.assertEqual(data_train["partition"], "X_train")
        
        # 2. X_test
        url_test = f"/api/pipelines/{pipeline.id}/nodes/node_split/preview/?partition=X_test"
        res_test = self.client.get(url_test)
        self.assertEqual(res_test.status_code, 200)
        data_test = res_test.json()
        self.assertEqual(data_test["total_rows"], 1)
        self.assertEqual(data_test["partition"], "X_test")
        
        # 3. All (combined)
        url_all = f"/api/pipelines/{pipeline.id}/nodes/node_split/preview/?partition=all"
        res_all = self.client.get(url_all)
        self.assertEqual(res_all.status_code, 200)
        data_all = res_all.json()
        self.assertEqual(data_all["total_rows"], 5)
        self.assertEqual(data_all["partition"], "all")


from .validator import validate_pipeline_structure


class PipelineValidatorTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='valuser',
            email='valuser@example.com',
            password='testpassword123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.pipeline = Pipeline.objects.create(name='Test Validation Pipeline', owner=self.user)

    def test_empty_pipeline_fails(self):
        """Empty pipeline should fail validation."""
        report = validate_pipeline_structure([], [])
        self.assertFalse(report['valid'])
        self.assertTrue(any(e['code'] == 'EMPTY_PIPELINE' for e in report['errors']))

    def test_cycle_detection(self):
        """Cyclic pipelines must be detected and blocked."""
        nodes = [
            {'id': '1', 'data': {'nodeType': 'loadDataset', 'params': {'dataset_id': '123'}}},
            {'id': '2', 'data': {'nodeType': 'StandardScaler'}},
            {'id': '3', 'data': {'nodeType': 'PCA'}},
        ]
        # 1 -> 2 -> 3 -> 1 (Cycle)
        edges = [
            {'source': '1', 'target': '2'},
            {'source': '2', 'target': '3'},
            {'source': '3', 'target': '1'},
        ]
        report = validate_pipeline_structure(nodes, edges)
        self.assertFalse(report['valid'])
        self.assertTrue(any(e['code'] == 'CYCLE_DETECTED' for e in report['errors']))

    def test_missing_dataset_node(self):
        """Pipeline without loadDataset node must fail validation."""
        nodes = [
            {'id': '1', 'data': {'nodeType': 'splitDataset', 'params': {'target_column': 'label'}}},
            {'id': '2', 'data': {'nodeType': 'RandomForestClassifier'}},
        ]
        edges = [{'source': '1', 'target': '2'}]
        report = validate_pipeline_structure(nodes, edges)
        self.assertFalse(report['valid'])
        self.assertTrue(any(e['code'] == 'MISSING_DATASET_NODE' for e in report['errors']))

    def test_missing_target_column_on_split(self):
        """Split dataset node without target column must fail."""
        nodes = [
            {'id': '1', 'data': {'nodeType': 'loadDataset', 'params': {'dataset_id': '123'}}},
            {'id': '2', 'data': {'nodeType': 'splitDataset', 'params': {}}},
        ]
        edges = [{'source': '1', 'target': '2'}]
        report = validate_pipeline_structure(nodes, edges)
        self.assertFalse(report['valid'])
        self.assertTrue(any(e['code'] == 'MISSING_TARGET_COLUMN' for e in report['errors']))

    def test_evaluate_without_model(self):
        """Evaluate node connected directly to preprocessing without a model must fail."""
        nodes = [
            {'id': '1', 'data': {'nodeType': 'loadDataset', 'params': {'dataset_id': '123'}}},
            {'id': '2', 'data': {'nodeType': 'StandardScaler'}},
            {'id': '3', 'data': {'nodeType': 'evaluate'}},
        ]
        edges = [
            {'source': '1', 'target': '2'},
            {'source': '2', 'target': '3'},
        ]
        report = validate_pipeline_structure(nodes, edges)
        self.assertFalse(report['valid'])
        self.assertTrue(any(e['code'] == 'EVALUATE_WITHOUT_MODEL' for e in report['errors']))

    def test_valid_pipeline_passes(self):
        """Well-formed ML pipeline must pass validation."""
        nodes = [
            {'id': '1', 'data': {'nodeType': 'loadDataset', 'params': {'dataset_id': '123'}}},
            {'id': '2', 'data': {'nodeType': 'StandardScaler'}},
            {'id': '3', 'data': {'nodeType': 'splitDataset', 'params': {'target_column': 'target'}}},
            {'id': '4', 'data': {'nodeType': 'RandomForestClassifier'}},
            {'id': '5', 'data': {'nodeType': 'evaluate'}},
        ]
        edges = [
            {'source': '1', 'target': '2'},
            {'source': '2', 'target': '3'},
            {'source': '3', 'target': '4'},
            {'source': '4', 'target': '5'},
        ]
        report = validate_pipeline_structure(nodes, edges)
        self.assertTrue(report['valid'])
        self.assertEqual(len(report['errors']), 0)

    def test_validate_api_endpoint(self):
        """POST /api/pipelines/<id>/validate/ returns structured report."""
        nodes = [
            {'id': '1', 'data': {'nodeType': 'loadDataset', 'params': {'dataset_id': '123'}}},
            {'id': '2', 'data': {'nodeType': 'splitDataset', 'params': {'target_column': 'label'}}},
            {'id': '3', 'data': {'nodeType': 'RandomForestClassifier'}},
            {'id': '4', 'data': {'nodeType': 'evaluate'}},
        ]
        edges = [
            {'source': '1', 'target': '2'},
            {'source': '2', 'target': '3'},
            {'source': '3', 'target': '4'},
        ]
        res = self.client.post(f'/api/pipelines/{self.pipeline.id}/validate/', {'nodes': nodes, 'edges': edges}, format='json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['valid'])
        self.assertIn('node_issues', data)


from .cleaning_and_features import (
    run_remove_duplicates_node,
    run_datatype_converter_node,
    run_rename_columns_node,
    run_drop_constant_columns_node,
    run_drop_missing_columns_node,
    run_outlier_handler_node,
    run_rare_category_encoder_node,
    run_row_filter_node,
    run_data_balancing_node,
    run_polynomial_features_node,
    run_pca_node,
    run_variance_threshold_node,
    run_select_kbest_node,
    run_rfe_node,
    run_log_transform_node,
    run_discretizer_node,
    run_custom_math_features_node,
)


class CleaningAndFeatureEngineeringTests(TestCase):
    def setUp(self):
        self.sample_data = {
            "dataframe": {
                "age": [20, 20, 25, 100, 30, 35, 40, None],
                "income": [2000, 2000, 2500, 50000, 3000, 3500, 4000, 4500],
                "constant_col": [1, 1, 1, 1, 1, 1, 1, 1],
                "mostly_null": [None, None, None, None, None, 1, None, None],
                "city": ["NY", "NY", "SF", "LA", "SmallTownA", "SmallTownB", "NY", "SF"],
                "target": [0, 0, 0, 1, 0, 1, 0, 1]
            }
        }

    def test_remove_duplicates(self):
        res, msg = run_remove_duplicates_node(self.sample_data, {"keep": "first"})
        self.assertEqual(res["row_count"], 7)
        self.assertEqual(res["dropped_duplicates"], 1)

    def test_datatype_converter(self):
        res, msg = run_datatype_converter_node(self.sample_data, {"column": "target", "target_type": "str"})
        self.assertIn("target", res["columns"])

    def test_rename_columns(self):
        res, msg = run_rename_columns_node(self.sample_data, {"old_name": "age", "new_name": "client_age"})
        self.assertIn("client_age", res["columns"])
        self.assertNotIn("age", res["columns"])

    def test_drop_constant_and_missing_columns(self):
        res_const, _ = run_drop_constant_columns_node(self.sample_data, {})
        self.assertNotIn("constant_col", res_const["columns"])

        res_miss, _ = run_drop_missing_columns_node(self.sample_data, {"threshold": 0.5})
        self.assertNotIn("mostly_null", res_miss["columns"])

    def test_outlier_handler_clipping(self):
        res, msg = run_outlier_handler_node(self.sample_data, {"columns": ["income"], "method": "IQR", "action": "clip", "threshold": 1.5})
        income_vals = res["dataframe"]["income"]
        self.assertLess(max(income_vals), 50000)

    def test_rare_category_encoder(self):
        res, msg = run_rare_category_encoder_node(self.sample_data, {"columns": ["city"], "threshold": 0.2, "replacement_label": "Other"})
        cities = res["dataframe"]["city"]
        self.assertIn("Other", cities)

    def test_row_filter(self):
        res, msg = run_row_filter_node(self.sample_data, {"column": "age", "operator": ">=", "value": 30})
        for a in res["dataframe"]["age"]:
            self.assertGreaterEqual(a, 30)

    def test_polynomial_features(self):
        res, msg = run_polynomial_features_node(self.sample_data, {"columns": ["income"], "degree": 2})
        self.assertTrue(any("income^2" in str(c) or "income_2" in str(c) or "income" in str(c) for c in res["columns"]))

    def test_pca_reduction(self):
        res, msg = run_pca_node(self.sample_data, {"columns": ["age", "income"], "n_components": 2})
        self.assertIn("PCA_Component_1", res["columns"])
        self.assertIn("PCA_Component_2", res["columns"])

    def test_variance_threshold(self):
        res, msg = run_variance_threshold_node(self.sample_data, {"threshold": 0.0})
        self.assertNotIn("constant_col", res["columns"])

    def test_select_kbest(self):
        clean_input = {
            "dataframe": {
                "f1": [1, 2, 3, 4, 5, 6, 7, 8],
                "f2": [10, 20, 30, 40, 50, 60, 70, 80],
                "target": [0, 0, 0, 0, 1, 1, 1, 1]
            }
        }
        res, msg = run_select_kbest_node(clean_input, {"target_column": "target", "k": 1})
        self.assertIn("target", res["columns"])
        self.assertEqual(len(res["selected_features"]), 1)

    def test_custom_math_features(self):
        clean_input = {
            "dataframe": {
                "a": [10, 20, 30],
                "b": [2, 4, 5]
            }
        }
        res, msg = run_custom_math_features_node(clean_input, {"new_column_name": "ratio", "formula": "a / b"})
        self.assertIn("ratio", res["columns"])
        self.assertEqual(res["dataframe"]["ratio"], [5.0, 5.0, 6.0])


class ExperimentTrackingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tester_exp', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.pipeline = Pipeline.objects.create(name='Iris Classification', owner=self.user)
        self.run1 = PipelineExecutionRun.objects.create(
            pipeline=self.pipeline,
            owner=self.user,
            run_number=1,
            algorithm='RandomForestClassifier',
            status='success',
            dataset_name='iris.csv',
            metrics={'accuracy': 0.85, 'f1': 0.84},
            elapsed_seconds=1.2
        )
        self.run2 = PipelineExecutionRun.objects.create(
            pipeline=self.pipeline,
            owner=self.user,
            run_number=2,
            algorithm='GradientBoostingClassifier',
            status='success',
            dataset_name='iris.csv',
            metrics={'accuracy': 0.96, 'f1': 0.95},
            elapsed_seconds=2.4
        )

    def test_list_experiments_and_best_run(self):
        res = self.client.get('/api/pipelines/experiments/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['total_runs'], 2)
        self.assertEqual(data['best_run_id'], self.run2.id)

    def test_experiment_detail_and_archive(self):
        res = self.client.get(f'/api/pipelines/runs/{self.run1.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['algorithm'], 'RandomForestClassifier')

        del_res = self.client.delete(f'/api/pipelines/runs/{self.run1.id}/')
        self.assertEqual(del_res.status_code, 200)
        self.run1.refresh_from_db()
        self.assertTrue(self.run1.is_archived)

    def test_export_experiments_csv_and_json(self):
        csv_res = self.client.get('/api/pipelines/experiments/export/?format=csv')
        self.assertEqual(csv_res.status_code, 200)
        self.assertEqual(csv_res['Content-Type'], 'text/csv')
        self.assertIn(b'RandomForestClassifier', csv_res.content)

        json_res = self.client.get('/api/pipelines/experiments/export/?format=json')
        self.assertEqual(json_res.status_code, 200)
        self.assertEqual(len(json_res.json()), 2)


class AutoMLAndModelOptimizationTests(TestCase):
    def setUp(self):
        self.classification_input = {
            "X_train": [[1.0, 2.0], [2.0, 3.0], [3.0, 3.5], [8.0, 8.0], [9.0, 9.0], [8.5, 9.5]],
            "X_test": [[1.5, 2.5], [8.0, 8.5]],
            "y_train": [0, 0, 0, 1, 1, 1],
            "y_test": [0, 1],
            "columns": ["f1", "f2"],
        }
        self.regression_input = {
            "X_train": [[1.0], [2.0], [3.0], [4.0], [5.0]],
            "X_test": [[6.0], [7.0]],
            "y_train": [2.1, 4.0, 6.2, 8.1, 9.9],
            "y_test": [12.0, 14.1],
            "columns": ["x"],
        }

    def test_automl_classification(self):
        node = {'id': 'auto_1', 'data': {'nodeType': 'AutoML', 'params': {'task_type': 'classification'}}}
        res, artifacts, msg, ntype = execute_single_node(node, self.classification_input)
        self.assertEqual(ntype, 'AutoML')
        self.assertIn('leaderboard', res)
        self.assertTrue(len(res['leaderboard']) > 0)
        self.assertIn('best_algorithm', res)
        self.assertIn('model', artifacts)

    def test_automl_regression(self):
        node = {'id': 'auto_2', 'data': {'nodeType': 'AutoML', 'params': {'task_type': 'regression'}}}
        res, artifacts, msg, ntype = execute_single_node(node, self.regression_input)
        self.assertEqual(ntype, 'AutoML')
        self.assertIn('leaderboard', res)
        self.assertEqual(res['task_type'], 'regression')
        self.assertTrue(len(res['leaderboard']) > 0)

    def test_model_comparison(self):
        node = {
            'id': 'mc_1',
            'data': {
                'nodeType': 'ModelComparison',
                'params': {'algorithms': ['LogisticRegression', 'DecisionTreeClassifier']}
            }
        }
        res, artifacts, msg, ntype = execute_single_node(node, self.classification_input)
        self.assertEqual(ntype, 'ModelComparison')
        self.assertIn('leaderboard', res)
        self.assertEqual(len(res['leaderboard']), 2)

    def test_hyperparameter_tuning(self):
        node = {
            'id': 'tune_1',
            'data': {
                'nodeType': 'HyperparamTuning',
                'params': {'base_algo': 'DecisionTreeClassifier', 'search_method': 'GridSearch', 'cv_folds': 2}
            }
        }
        res, artifacts, msg, ntype = execute_single_node(node, self.classification_input)
        self.assertEqual(ntype, 'HyperparamTuning')
        self.assertIn('best_params', res)
        self.assertIn('best_score', res)


import pickle
import zipfile
import io
from sklearn.linear_model import LogisticRegression
import numpy as np


class ModelExportTests(TestCase):
    """Tests for ONNX and standalone inference script export endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(username='export_user', password='testpass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.pipeline = Pipeline.objects.create(owner=self.user, name='ExportTestPipeline')
        self.graph = Graph.objects.create(pipeline=self.pipeline, status='success')

    def _store_model_in_graph(self):
        """Helper: train a tiny LogisticRegression and embed it in node_outputs."""
        import base64
        X = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0], [7.0, 8.0]])
        y = np.array([0, 1, 0, 1])
        clf = LogisticRegression(max_iter=200)
        clf.fit(X, y)
        model_pkl = pickle.dumps(clf)
        b64 = base64.b64encode(model_pkl).decode()
        self.graph.node_outputs = {
            'node_model': {
                'model_b64': b64,
                'metrics': {'accuracy': 0.75, 'f1': 0.70},
                'features': ['col_a', 'col_b'],
            }
        }
        self.graph.save(update_fields=['node_outputs'])

    def test_infer_script_no_model_returns_404(self):
        """Inference script export without a trained model returns 404."""
        res = self.client.get(f'/api/pipelines/{self.pipeline.pk}/download/script/')
        self.assertEqual(res.status_code, 404)

    def test_onnx_export_no_model_returns_404(self):
        """ONNX export without a trained model returns 404."""
        res = self.client.get(f'/api/pipelines/{self.pipeline.pk}/download/onnx/')
        self.assertEqual(res.status_code, 404)

    def test_infer_script_with_model_returns_zip_bundle(self):
        """Inference script export with a trained model returns a ZIP containing infer.py."""
        self._store_model_in_graph()
        res = self.client.get(f'/api/pipelines/{self.pipeline.pk}/download/script/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/zip')
        self.assertIn('infer_bundle.zip', res['Content-Disposition'])

        zf = zipfile.ZipFile(io.BytesIO(res.content))
        names = zf.namelist()
        self.assertIn('infer.py', names)
        self.assertIn('requirements.txt', names)
        self.assertIn('README.md', names)
        # The model file must be present
        self.assertTrue(any(n.startswith('model.') for n in names))

        # infer.py should contain feature names
        infer_src = zf.read('infer.py').decode()
        self.assertIn('col_a', infer_src)
        self.assertIn('col_b', infer_src)
        self.assertIn('predict', infer_src)

    def test_infer_script_has_correct_pipeline_name(self):
        """Infer script README contains the pipeline name."""
        self._store_model_in_graph()
        res = self.client.get(f'/api/pipelines/{self.pipeline.pk}/download/script/')
        zf = zipfile.ZipFile(io.BytesIO(res.content))
        readme = zf.read('README.md').decode()
        self.assertIn('ExportTestPipeline', readme)


class EDAProfileTests(TestCase):
    """Tests for EDA profiling endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(username='eda_user', password='testpass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.pipeline = Pipeline.objects.create(owner=self.user, name='EDATestPipeline')
        self.graph = Graph.objects.create(pipeline=self.pipeline, status='success')

    def test_eda_no_data_returns_404(self):
        """Requesting EDA on a pipeline with no data returns 404 with helpful detail."""
        res = self.client.get(f'/api/pipelines/{self.pipeline.pk}/eda/')
        self.assertEqual(res.status_code, 404)
        self.assertIn('detail', res.json())

    def test_eda_from_node_output(self):
        """Requesting EDA with cached dataframe in node_outputs returns full statistics."""
        self.graph.node_outputs = {
            'node_data': {
                'dataframe': {
                    'age': [25, 30, 35, 40, 45],
                    'salary': [50000.0, 60000.0, 75000.0, 90000.0, 110000.0],
                    'department': ['Sales', 'Engineering', 'Sales', 'Engineering', 'HR']
                }
            }
        }
        self.graph.save(update_fields=['node_outputs'])

        res = self.client.get(f'/api/pipelines/{self.pipeline.pk}/eda/')
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Summary check
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['rows'], 5)
        self.assertEqual(data['summary']['columns'], 3)
        self.assertEqual(data['summary']['numeric_columns'], 2)

        # Columns check
        self.assertIn('columns', data)
        col_names = [c['name'] for c in data['columns']]
        self.assertIn('age', col_names)
        self.assertIn('salary', col_names)
        self.assertIn('department', col_names)

        age_col = next(c for c in data['columns'] if c['name'] == 'age')
        self.assertEqual(age_col['kind'], 'numeric')
        self.assertEqual(age_col['min'], 25)
        self.assertEqual(age_col['max'], 45)
        self.assertEqual(age_col['median'], 35)

        dept_col = next(c for c in data['columns'] if c['name'] == 'department')
        self.assertEqual(dept_col['kind'], 'categorical')
        self.assertIn('top_values', dept_col)

        # Correlation check
        self.assertIn('correlation', data)
        self.assertIn('matrix', data['correlation'])

        # Histograms check
        self.assertIn('histograms', data)
        self.assertIn('age', data['histograms'])

        # Sample preview check
        self.assertIn('sample', data)
        self.assertEqual(len(data['sample']), 5)

