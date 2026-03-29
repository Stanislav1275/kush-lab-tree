import type { JustNode } from "../../../shared/lib/tree/model/tree.ts";
import { BasicEvent, GateNode } from "../../../shared/lib/tree/model/tree.ts";
import type { Edge, Node } from "@xyflow/react";
import { layoutFaultTree } from "./layout.ts";
import type { FaultTreeEventData, FaultTreeGateData } from "../ui/fragments.tsx";

function makeEdgeIdCounters() {
    const seq = new Map<string, number>();
    return (parentId: string, childId: string) => {
        const base = `${parentId}->${childId}`;
        const n = seq.get(base) ?? 0;
        seq.set(base, n + 1);
        return n === 0 ? base : `${base}~${n}`;
    };
}

function collectEdges(
    node: JustNode,
    parentId: string | undefined,
    edges: Edge[],
    nextEdgeId: (p: string, c: string) => string
): void {
    if (parentId) {
        edges.push({
            id: nextEdgeId(parentId, node.id),
            source: parentId,
            target: node.id,
            type: "smoothstep",
            style: { stroke: "#2563eb", strokeWidth: 1.65 },
        });
    }
    if (node instanceof GateNode) {
        node.children.forEach((child) => collectEdges(child, node.id, edges, nextEdgeId));
    }
}

export function flattenTree(root: JustNode): { nodes: Node[]; edges: Edge[] } {
    const positions = layoutFaultTree(root);
    const edges: Edge[] = [];
    collectEdges(root, undefined, edges, makeEdgeIdCounters());

    const nodes: Node[] = [];
    const placed = new Set<string>();

    const visit = (node: JustNode) => {
        const pos = positions.get(node.id) ?? { x: 0, y: 0 };

        if (node instanceof BasicEvent) {
            if (placed.has(node.id)) {
                return;
            }
            placed.add(node.id);
            const data: FaultTreeEventData = {
                code: node.id,
                name: node.name,
                probability: node.probability,
            };
            nodes.push({
                id: node.id,
                type: "faultEvent",
                position: pos,
                data,
            });
            return;
        }

        if (node instanceof GateNode) {
            if (placed.has(node.id)) {
                return;
            }
            placed.add(node.id);
            const data: FaultTreeGateData = {
                code: node.id,
                name: node.name,
                gate: node.gate,
            };
            nodes.push({
                id: node.id,
                type: "faultGate",
                position: pos,
                data,
            });
            node.children.forEach(visit);
        }
    };

    visit(root);

    return { nodes, edges };
}
