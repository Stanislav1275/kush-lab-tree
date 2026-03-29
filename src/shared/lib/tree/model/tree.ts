import { z } from "zod";

export type GateType = "AND" | "OR";

export type TreeJSON =
    | {
    type: "basic";
    id: string;
    name: string;
    probability: number;
}
    | {
    type: "gate";
    id: string;
    name: string;
    gate: GateType;
    children: TreeJSON[];
};

export const TreeJSONSchema: z.ZodType<TreeJSON> = z.lazy(() =>
    z.union([
        z
            .object({
                type: z.literal("basic"),
                id: z.string(),
                name: z.string(),
                probability: z.number()
            })
            .passthrough(),
        z
            .object({
                type: z.literal("gate"),
                id: z.string(),
                name: z.string(),
                gate: z.union([z.literal("AND"), z.literal("OR")]),
                children: z.array(TreeJSONSchema)
            })
            .passthrough()
    ])
);

export abstract class JustNode {
    protected constructor(
        public readonly id: string,
        public readonly name: string
    ) {}
}

export class BasicEvent extends JustNode {
    private _probability: number;

    constructor(id: string, name: string, probability = 0) {
        super(id, name);
        this._probability = probability;
    }

    get probability(): number {
        return this._probability;
    }

    set probability(value: number) {
        if (value < 0 || value > 1) {
            throw new Error("Probability must be between 0 and 1");
        }
        this._probability = value;
    }
}

export class GateNode extends JustNode {
    constructor(
        id: string,
        name: string,
        public readonly gate: GateType,
        private readonly _children: JustNode[] = []
    ) {
        super(id, name);
    }

    get children(): readonly JustNode[] {
        return this._children;
    }

    addChild(node: JustNode) {
        this._children.push(node);
    }
}

export interface ICalculator {
    calculate(node: JustNode): number;
}

export class ProbabilityCalculator implements ICalculator {
    calculate(node: JustNode): number {
        if (node instanceof BasicEvent) {
            return node.probability;
        }

        if (node instanceof GateNode) {
            const probs = node.children.map(child => this.calculate(child));

            if (node.gate === "AND") {
                return probs.reduce((a, b) => a * b, 1);
            }

            if (node.gate === "OR") {
                return 1 - probs.reduce((a, b) => a * (1 - b), 1);
            }
        }

        throw new Error("Unknown node type");
    }
}

export class FaultTree {
    constructor(
        public readonly root: JustNode,
        private readonly calculator: ICalculator = new ProbabilityCalculator()
    ) {}

    calculate(): number {
        return this.calculator.calculate(this.root);
    }

    getLeaves(): BasicEvent[] {
        const result: BasicEvent[] = [];

        const traverse = (node: JustNode) => {
            if (node instanceof BasicEvent) {
                result.push(node);
                return;
            }

            if (node instanceof GateNode) {
                node.children.forEach(traverse);
            }
        };

        traverse(this.root);
        return result;
    }

    toMap(): Map<string, JustNode> {
        const map = new Map<string, JustNode>();

        const traverse = (node: JustNode) => {
            if (map.has(node.id)) return;

            map.set(node.id, node);

            if (node instanceof GateNode) {
                node.children.forEach(traverse);
            }
        };

        traverse(this.root);
        return map;
    }

    setLeafProbabilities(fn: (node: BasicEvent, index: number) => number) {
        const leaves = this.getLeaves();

        leaves.forEach((node, index) => {
            node.probability = fn(node, index);
        });
    }

    randomizeLeaves(min = 0, max = 1) {
        this.setLeafProbabilities(() => Math.random() * (max - min) + min);
    }

    print(node: JustNode = this.root, indent = 0) {
        const pad = " ".repeat(indent);

        if (node instanceof BasicEvent) {
            console.log(`${pad}- [F] ${node.id} (${node.name}) p=${node.probability}`);
            return;
        }

        if (node instanceof GateNode) {
            console.log(`${pad}- [G:${node.gate}] ${node.id} (${node.name})`);
            node.children.forEach(child => this.print(child, indent + 2));
            return;
        }

        throw new Error("Unknown node type");
    }

    toJSON(node: JustNode = this.root): TreeJSON {
        if (node instanceof BasicEvent) {
            return {
                type: "basic",
                id: node.id,
                name: node.name,
                probability: node.probability
            };
        }

        if (node instanceof GateNode) {
            return {
                type: "gate",
                id: node.id,
                name: node.name,
                gate: node.gate,
                children: node.children.map(child => this.toJSON(child))
            };
        }

        throw new Error("Unknown node type");
    }
}

export class FaultTreeMapper {
    static fromJsonTyped(json: TreeJSON): JustNode {
        if (json.type === "basic") {
            return new BasicEvent(json.id, json.name, json.probability);
        }

        if (json.type === "gate") {
            const node = new GateNode(json.id, json.name, json.gate);

            json.children.forEach(child => {
                node.addChild(FaultTreeMapper.fromJsonTyped(child));
            });

            return node;
        }

        throw new Error("Invalid JSON type");
    }

    static fromExternalJson(input: unknown): JustNode {
        const parsed = TreeJSONSchema.parse(input);
        return this.fromJsonTyped(parsed);
    }

    static safeFromExternalJson(
        input: unknown
    ):
        | { success: true; node: JustNode }
        | { success: false; error: unknown } {
        const result = TreeJSONSchema.safeParse(input);

        if (!result.success) {
            return { success: false, error: result.error };
        }

        return {
            success: true,
            node: this.fromJsonTyped(result.data)
        };
    }
}

export class FaultTreeBuilder {
    private nodes = new Map<string, JustNode>();

    basic(id: string, name: string, probability = 0) {
        this.nodes.set(id, new BasicEvent(id, name, probability));
        return this;
    }

    gate(id: string, name: string, gate: GateType) {
        this.nodes.set(id, new GateNode(id, name, gate));
        return this;
    }

    link(parentId: string, ...childrenIds: string[]) {
        const parent = this.nodes.get(parentId);

        if (!(parent instanceof GateNode)) {
            throw new Error(`${parentId} is not a GateNode`);
        }

        childrenIds.forEach(id => {
            const child = this.nodes.get(id);
            if (!child) throw new Error(`Node ${id} not found`);
            parent.addChild(child);
        });

        return this;
    }

    setProbabilities(map: Record<string, number>) {
        for (const [id, prob] of Object.entries(map)) {
            const node = this.nodes.get(id);
            if (node instanceof BasicEvent) {
                node.probability = prob;
            }
        }
        return this;
    }

    build(rootId: string, calculator?: ICalculator): FaultTree {
        const root = this.nodes.get(rootId);
        if (!root) throw new Error("Root not found");

        return new FaultTree(root, calculator);
    }
}