"""Directed Acyclic Graph (DAG) construction and topological sorting for model orchestration."""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from collections import defaultdict, deque


@dataclass
class DAGNode:
    """Individual execution node within the orchestration DAG."""
    id: str
    label: str
    node_type: str  # 'specialized_model', 'document_pipeline', 'evidence_synthesis'
    modality: str
    status: str  # 'ready', 'not_configured', 'pending'
    capability_id: Optional[str] = None
    model_id: Optional[str] = None
    asset_id: Optional[str] = None
    asset_filename: Optional[str] = None
    estimated_ram_mb: int = 512
    estimated_latency_ms: int = 500
    dependencies: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DAGEdge:
    """Directed dependency link between two nodes in the DAG."""
    from_node: str
    to_node: str
    relationship: str = "dependency"  # 'data_flow', 'dependency', 'evidence_fusion'

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ExecutionDAG:
    """Represents the complete execution DAG with cycle detection and topological ordering."""

    def __init__(self):
        self.nodes: Dict[str, DAGNode] = {}
        self.edges: List[DAGEdge] = []

    def add_node(self, node: DAGNode) -> None:
        self.nodes[node.id] = node

    def add_edge(self, from_node: str, to_node: str, relationship: str = "dependency") -> None:
        if from_node not in self.nodes:
            raise ValueError(f"Source node '{from_node}' does not exist in DAG")
        if to_node not in self.nodes:
            raise ValueError(f"Target node '{to_node}' does not exist in DAG")
        
        # Add dependency to target node if not already present
        if from_node not in self.nodes[to_node].dependencies:
            self.nodes[to_node].dependencies.append(from_node)

        self.edges.append(DAGEdge(from_node=from_node, to_node=to_node, relationship=relationship))

    def topological_sort(self) -> List[str]:
        """Compute deterministic topological execution order using Kahn's algorithm."""
        in_degree: Dict[str, int] = {node_id: 0 for node_id in self.nodes}
        adj: Dict[str, List[str]] = defaultdict(list)

        for edge in self.edges:
            adj[edge.from_node].append(edge.to_node)
            in_degree[edge.to_node] += 1

        # Priority queue / sorted queue for deterministic tie-breaking
        # Sort node IDs alphabetically for deterministic behavior
        queue = deque(sorted([node_id for node_id, deg in in_degree.items() if deg == 0]))
        ordered: List[str] = []

        while queue:
            curr = queue.popleft()
            ordered.append(curr)

            # Sort neighbors for deterministic execution order
            for neighbor in sorted(adj[curr]):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(ordered) != len(self.nodes):
            # Graph has a cycle, fallback to sequential insertion order
            return list(self.nodes.keys())

        return ordered

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges],
            "topological_order": self.topological_sort(),
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
        }
