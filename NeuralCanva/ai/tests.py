import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
from datasets.models import Dataset
from pipelines.models import Pipeline, Graph


class AICopilotAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testaiuser", password="password123")
        self.client.force_authenticate(user=self.user)

        # Create sample dataset
        self.dataset = Dataset.objects.create(
            name="housing_sample.csv",
            owner=self.user,
            columns=["price", "bedrooms", "bathrooms", "sqft_living", "city"],
            column_types={
                "price": "numerical",
                "bedrooms": "numerical",
                "bathrooms": "numerical",
                "sqft_living": "numerical",
                "city": "categorical",
            },
            row_count=500,
        )

        # Create sample pipeline
        self.pipeline = Pipeline.objects.create(
            name="Housing Predictor",
            owner=self.user,
        )
        self.graph = Graph.objects.create(
            pipeline=self.pipeline,
            status="failed",
            error="LogisticRegression with penalty='l1' requires solver='liblinear'",
            nodes=[
                {
                    "id": "node_1",
                    "type": "taskNode",
                    "data": {
                        "nodeType": "loadDataset",
                        "datasetId": str(self.dataset.id),
                        "status": "success",
                    }
                },
                {
                    "id": "node_2",
                    "type": "taskNode",
                    "data": {
                        "nodeType": "LogisticRegression",
                        "status": "failed",
                        "params": {"penalty": "l1", "solver": "lbfgs"},
                    }
                }
            ],
            edges=[{"source": "node_1", "target": "node_2"}]
        )

    def test_ai_status(self):
        res = self.client.get('/api/ai/status/')
        self.assertEqual(res.status_code, 200)
        self.assertIn("online", res.data)
        self.assertIn("active_provider", res.data)

    def test_ai_context(self):
        res = self.client.get(f'/api/ai/context/?dataset_id={self.dataset.id}&pipeline_id={self.pipeline.id}')
        self.assertEqual(res.status_code, 200)
        self.assertIn("project", res.data)
        self.assertIn("dataset", res.data)
        self.assertIn("pipeline", res.data)
        self.assertEqual(res.data["dataset"]["name"], "housing_sample.csv")
        self.assertEqual(res.data["pipeline"]["id"], self.pipeline.id)

    def test_ai_chat(self):
        res = self.client.post('/api/ai/chat/', {
            "message": "Hello AI Copilot, how can you help me?",
            "dataset_id": str(self.dataset.id),
            "pipeline_id": self.pipeline.id,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("text", res.data)
        self.assertTrue(len(res.data["text"]) > 0)

    def test_analyze_dataset(self):
        res = self.client.post('/api/ai/analyze-dataset/', {
            "dataset_id": str(self.dataset.id),
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("text", res.data)
        self.assertEqual(res.data.get("action_type"), "dataset_analysis")
        self.assertIn("housing_sample.csv", res.data["text"])

    def test_recommend_model(self):
        res = self.client.post('/api/ai/recommend-model/', {
            "dataset_id": str(self.dataset.id),
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("text", res.data)
        self.assertEqual(res.data.get("action_type"), "model_recommendation")

    def test_generate_pipeline(self):
        res = self.client.post('/api/ai/generate-pipeline/', {
            "dataset_id": str(self.dataset.id),
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("text", res.data)
        self.assertEqual(res.data.get("action_type"), "generate_pipeline")
        payload = res.data.get("payload", {})
        self.assertIn("nodes", payload)
        self.assertIn("edges", payload)
        self.assertTrue(len(payload["nodes"]) >= 5)

    def test_debug_pipeline(self):
        res = self.client.post('/api/ai/debug-pipeline/', {
            "pipeline_id": self.pipeline.id,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("text", res.data)
        self.assertEqual(res.data.get("action_type"), "debug_pipeline")
        self.assertIn("solver", res.data["text"].lower())

    def test_explain_node(self):
        res = self.client.post('/api/ai/explain-node/', {
            "node_type": "RandomForestClassifier",
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("title", res.data)
        self.assertIn("hyperparameters_guide", res.data)

    def test_optimize_pipeline(self):
        res = self.client.post('/api/ai/optimize-pipeline/', {
            "pipeline_id": self.pipeline.id,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn("recommendations", res.data)

    def test_apply_action_generate_pipeline(self):
        gen_res = self.client.post('/api/ai/generate-pipeline/', {
            "dataset_id": str(self.dataset.id),
        }, format='json')
        payload = gen_res.data["payload"]

        apply_res = self.client.post('/api/ai/apply-action/', {
            "action": "apply_generated_pipeline",
            "payload": payload,
        }, format='json')
        self.assertEqual(apply_res.status_code, 200)
        self.assertTrue(apply_res.data.get("success"))
        new_pid = apply_res.data.get("pipeline_id")
        self.assertTrue(Pipeline.objects.filter(id=new_pid).exists())
        graph = Graph.objects.get(pipeline_id=new_pid)
        self.assertTrue(len(graph.nodes) >= 5)

    def test_apply_action_update_node(self):
        update_res = self.client.post('/api/ai/apply-action/', {
            "action": "update_node_params",
            "payload": {
                "pipeline_id": self.pipeline.id,
                "node_id": "node_2",
                "changes": {"solver": "liblinear"},
            }
        }, format='json')
        self.assertEqual(update_res.status_code, 200)
        self.assertTrue(update_res.data.get("success"))
        self.graph.refresh_from_db()
        target_node = next(n for n in self.graph.nodes if n["id"] == "node_2")
        self.assertEqual(target_node["data"]["params"]["solver"], "liblinear")
