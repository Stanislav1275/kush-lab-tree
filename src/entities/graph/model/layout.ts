import { BasicEvent, GateNode, type JustNode } from "../../../shared/lib/tree/model/tree.ts";

/** Ширина под базовое событие (прямоугольник). */
const LEAF_W = 158;
/** Ширина под вентиль (с символом МЭК). */
const GATE_W = 168;
const H_GAP = 20;
const V_GAP = 92;
const MARGIN = 24;

export type Point = { x: number; y: number };

interface SubtreeLayout {
    width: number;
    positions: Map<string, Point>;
}

function layoutSubtree(node: JustNode, depth: number): SubtreeLayout {
    const y = depth * V_GAP;

    if (node instanceof BasicEvent) {
        const positions = new Map<string, Point>();
        positions.set(node.id, { x: 0, y });
        return { width: LEAF_W, positions };
    }

    if (node instanceof GateNode) {
        if (node.children.length === 0) {
            const positions = new Map<string, Point>();
            positions.set(node.id, { x: 0, y });
            return { width: GATE_W, positions };
        }

        const childLayouts = node.children.map((c) => layoutSubtree(c, depth + 1));
        const rawSpan =
            childLayouts.reduce((sum, cl) => sum + cl.width, 0) +
            H_GAP * Math.max(0, childLayouts.length - 1);
        const span = Math.max(rawSpan, GATE_W);

        const positions = new Map<string, Point>();
        let xCursor = (span - rawSpan) / 2;

        for (let i = 0; i < childLayouts.length; i++) {
            const cl = childLayouts[i];
            for (const [id, pos] of cl.positions) {
                positions.set(id, { x: pos.x + xCursor, y: pos.y });
            }
            xCursor += cl.width + (i < childLayouts.length - 1 ? H_GAP : 0);
        }

        const parentX = span / 2 - GATE_W / 2;
        positions.set(node.id, { x: parentX, y });

        return { width: span, positions };
    }

    throw new Error("Unknown node type");
}

export function layoutFaultTree(root: JustNode): Map<string, Point> {
    const { positions } = layoutSubtree(root, 0);
    let minX = Infinity;
    let minY = Infinity;
    for (const p of positions.values()) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
    }
    if (!Number.isFinite(minX)) {
        return positions;
    }
    const shifted = new Map<string, Point>();
    for (const [id, p] of positions) {
        shifted.set(id, { x: p.x - minX + MARGIN, y: p.y - minY + MARGIN });
    }
    return shifted;
}

export const faultTreeLayoutConstants = { LEAF_W, GATE_W, V_GAP, MARGIN };
