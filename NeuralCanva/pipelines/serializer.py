from rest_framework import serializers
from .models import Pipeline, Graph


class GraphSerializer(serializers.ModelSerializer):
    class Meta:
        model = Graph
        fields = ['id', 'nodes', 'edges', 'status', 'result', 'error', 'updated_at']
        read_only_fields = ['status', 'result', 'error', 'updated_at']

    def validate(self, data):
        nodes = data.get('nodes', [])
        edges = data.get('edges', [])
        self._validate_dag(nodes, edges)
        return data

    def _validate_dag(self, nodes, edges):
        node_ids = {n['id'] for n in nodes}

        # check all edge endpoints exist
        for edge in edges:
            if edge['source'] not in node_ids or edge['target'] not in node_ids:
                raise serializers.ValidationError("Edge references a node that doesn't exist.")

        # cycle detection via DFS
        adjacency = {nid: [] for nid in node_ids}
        for edge in edges:
            adjacency[edge['source']].append(edge['target'])

        visited = set()
        rec_stack = set()

        def has_cycle(node):
            visited.add(node)
            rec_stack.add(node)
            for neighbour in adjacency[node]:
                if neighbour not in visited:
                    if has_cycle(neighbour):
                        return True
                elif neighbour in rec_stack:
                    return True
            rec_stack.remove(node)
            return False

        for node_id in node_ids:
            if node_id not in visited:
                if has_cycle(node_id):
                    raise serializers.ValidationError("Graph contains a cycle. Must be a DAG.")


class PipelineSerializer(serializers.ModelSerializer):
    graph = GraphSerializer(read_only=True)
    owner = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Pipeline
        fields = ['id', 'name', 'description', 'owner', 'graph', 'created_at', 'updated_at']
        read_only_fields = ['owner', 'created_at', 'updated_at']