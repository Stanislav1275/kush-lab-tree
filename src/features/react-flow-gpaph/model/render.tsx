import React, { useCallback, useMemo } from "react";
import {
    Background,
    Controls,
    type NodeTypes,
    type ReactFlowInstance,
    ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { JustNode } from "../../../shared/lib/tree/model/tree.ts";
import type { FaultTreeLabelMode } from "../../../entities/graph/model/label-mode-context.tsx";
import { FaultTreeLabelContext } from "../../../entities/graph/model/label-mode-context.tsx";
import { flattenTree } from "../../../entities/graph/model/utils.tsx";
import {
    FaultTreeEventNode,
    FaultTreeGateNode,
} from "../../../entities/graph/ui/fragments.tsx";

const nodeTypes = {
    faultEvent: FaultTreeEventNode,
    faultGate: FaultTreeGateNode,
} satisfies NodeTypes;

interface Props {
    treeRoot: JustNode;
    labelMode: FaultTreeLabelMode;
}

export const FaultTreeFlow: React.FC<Props> = ({ treeRoot, labelMode }) => {
    const { nodes, edges } = useMemo(() => flattenTree(treeRoot), [treeRoot]);

    const onInit = useCallback((instance: ReactFlowInstance) => {
        requestAnimationFrame(() => {
            instance.fitView({
                padding: 0.15,
                minZoom: 0.06,
                maxZoom: 1.35,
                duration: 200,
            });
        });
    }, []);

    return (
        <FaultTreeLabelContext.Provider value={labelMode}>
            <div className="fault-tree-flow">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onInit={onInit}
                    fitView
                    fitViewOptions={{ padding: 0.15, minZoom: 0.06, maxZoom: 1.35 }}
                    minZoom={0.05}
                    maxZoom={1.5}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={true}
                    proOptions={{ hideAttribution: true }}
                    defaultEdgeOptions={{
                        type: "smoothstep",
                    }}
                >
                    <Background gap={20} size={1} color="#cbd5e1" />
                    <Controls showInteractive={false} />
                </ReactFlow>
            </div>
        </FaultTreeLabelContext.Provider>
    );
};
