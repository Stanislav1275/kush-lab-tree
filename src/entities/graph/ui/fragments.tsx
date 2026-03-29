import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import "./fault-tree-nodes.css";
import type { GateType } from "../../../shared/lib/tree/model/tree.ts";
import { useFaultTreeLabelMode } from "../model/label-mode-context.tsx";
import { GateSymbol } from "./gate-symbols.tsx";

const gateText = (g: GateType) => (g === "AND" ? "И" : "ИЛИ");

export type FaultTreeEventData = Record<string, unknown> & {
    code: string;
    name: string;
    probability: number;
};

export type FaultTreeGateData = Record<string, unknown> & {
    code: string;
    name: string;
    gate: GateType;
};

export type FaultTreeEventNodeType = Node<FaultTreeEventData, "faultEvent">;
export type FaultTreeGateNodeType = Node<FaultTreeGateData, "faultGate">;

function PrimaryLabel({
    code,
    name,
}: {
    code: string;
    name: string;
}) {
    const mode = useFaultTreeLabelMode();
    if (mode === "id") {
        return (
            <>
                <div className="ft-node__primary ft-node__primary--mono">{code}</div>
                <div className="ft-node__secondary">{name}</div>
            </>
        );
    }
    return (
        <>
            <div className="ft-node__primary">{name}</div>
            <div className="ft-node__secondary ft-node__secondary--mono">{code}</div>
        </>
    );
}

export function FaultTreeEventNode({ data }: NodeProps<FaultTreeEventNodeType>) {
    return (
        <div className="ft-node ft-node--event">
            <Handle type="target" position={Position.Top} className="ft-handle" />
            <PrimaryLabel code={data.code} name={data.name} />
            <div className="ft-node__meta">p = {data.probability.toFixed(2)}</div>
            <Handle type="source" position={Position.Bottom} className="ft-handle" />
        </div>
    );
}

export function FaultTreeGateNode({ data }: NodeProps<FaultTreeGateNodeType>) {
    const isAnd = data.gate === "AND";
    return (
        <div className={`ft-node ft-node--gate ${isAnd ? "ft-node--gate-and" : "ft-node--gate-or"}`}>
            <Handle type="target" position={Position.Top} className="ft-handle" />
            <div className="ft-gate-symbol-wrap">
                <GateSymbol
                    gate={data.gate}
                    className={`ft-gate-symbol ${isAnd ? "ft-gate-symbol--and" : "ft-gate-symbol--or"}`}
                />
                <span className="ft-gate-badge">{gateText(data.gate)}</span>
            </div>
            <PrimaryLabel code={data.code} name={data.name} />
            <Handle type="source" position={Position.Bottom} className="ft-handle" />
        </div>
    );
}
