import React, { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import {
    Background,
    Controls,
    ReactFlow,
    type NodeProps,
    type NodeTypes,
    type ReactFlowInstance,
    type Edge,
    type Node,
    Handle,
    Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ==================== РўРРџР« Р РњРћР”Р•Р›Р¬ Р”Р•Р Р•Р’Рђ РћРўРљРђР—РћР’ ====================
export type GateType = "AND" | "OR";

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
    private _children: JustNode[] = [];

    constructor(
        id: string,
        name: string,
        public readonly gate: GateType,
        children: JustNode[] = []
    ) {
        super(id, name);
        this._children = [...children];
    }

    get children(): readonly JustNode[] {
        return this._children;
    }

    addChild(node: JustNode) {
        this._children.push(node);
    }
}

// ==================== РџРћРЎРўР РћРРўР•Р›Р¬ Р”Р•Р Р•Р’Рђ ====================
class FaultTreeBuilder {
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
        childrenIds.forEach((id) => {
            const child = this.nodes.get(id);
            if (!child) throw new Error(`Node ${id} not found`);
            parent.addChild(child);
        });
        return this;
    }

    build(rootId: string): JustNode {
        const root = this.nodes.get(rootId);
        if (!root) throw new Error("Root not found");
        return root;
    }
}

function clamp01(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x;
}

function pruneNode(node: JustNode, slider: number, rng: () => number): JustNode | null {
    if (node instanceof BasicEvent) {
        const threshold = clamp01(node.probability * slider);
        if (rng() < threshold) {
            return new BasicEvent(node.id, node.name, node.probability);
        }
        return null;
    }

    if (node instanceof GateNode) {
        if (node.gate === "OR") {
            const kept: JustNode[] = [];
            for (const child of node.children) {
                const pruned = pruneNode(child, slider, rng);
                if (pruned) kept.push(pruned);
            }
            if (kept.length === 0) return null;
            const g = new GateNode(node.id, node.name, "OR");
            kept.forEach((c) => g.addChild(c));
            return g;
        }

        const kept: JustNode[] = [];
        for (const child of node.children) {
            const pruned = pruneNode(child, slider, rng);
            if (!pruned) return null;
            kept.push(pruned);
        }
        const g = new GateNode(node.id, node.name, "AND");
        kept.forEach((c) => g.addChild(c));
        return g;
    }

    return null;
}

function tryGenerateRoot(template: JustNode, slider: number, maxAttempts = 50): JustNode | null {
    for (let i = 0; i < maxAttempts; i++) {
        const root = pruneNode(template, slider, Math.random);
        if (root) return root;
    }
    return null;
}

// ==================== Р”Р•Р Р•Р’Рћ РћРўРљРђР—РћР’ (63 Р‘РђР—РћР’Р«РҐ РЎРћР‘Р«РўРРЇ) ====================
const templateRoot = new FaultTreeBuilder()

    // 1. РњР•РўР•РћР РћР›РћР“РРЇ
    .basic("F1", "РљСЂР°С‚РєРѕРІСЂРµРјРµРЅРЅС‹Р№ Р»РёРІРµРЅСЊ", 0.4)
    .basic("F2", "Р”Р»РёС‚РµР»СЊРЅС‹Рµ РѕСЃР°РґРєРё", 0.35)
    .basic("F3", "РўСЂРѕРїРёС‡РµСЃРєРёР№ С†РёРєР»РѕРЅ", 0.05)
    .basic("F4", "Р‘С‹СЃС‚СЂРѕРµ С‚Р°СЏРЅРёРµ СЃРЅРµРіР°", 0.3)
    .basic("F5", "Р›РµРґСЏРЅС‹Рµ Р·Р°С‚РѕСЂС‹", 0.2)
    .basic("F6", "РЎРёР»СЊРЅС‹Р№ РІРµС‚РµСЂ (РЅР°РіРЅРµС‚Р°РЅРёРµ РІРѕРґС‹)", 0.15)
    .basic("F7", "РђРЅРѕРјР°Р»СЊРЅС‹Р№ РїСЂРёР»РёРІ", 0.08)
    .basic("F8", "РЁС‚РѕСЂРјРѕРІРѕР№ РЅР°РіРѕРЅ", 0.12)
    // 2. Р“РР”Р РћР›РћР“РРЇ Р Р РЈРЎР›Рћ
    .basic("F9", "Р—Р°РёР»РёРІР°РЅРёРµ СЂСѓСЃР»Р°", 0.3)
    .basic("F10", "РЎСѓР¶РµРЅРёРµ СЂСѓСЃР»Р°", 0.25)
    .basic("F11", "РћР±СЂСѓС€РµРЅРёРµ Р±РµСЂРµРіРѕРІ", 0.2)
    .basic("F12", "Р—Р°СЃРѕСЂРµРЅРёРµ СЂСѓСЃР»Р° РјСѓСЃРѕСЂРѕРј", 0.35)
    .basic("F13", "Р”РµС„РѕСЂРјР°С†РёСЏ РґРЅР°", 0.25)
    .basic("F14", "Р—Р°СЂР°СЃС‚Р°РЅРёРµ СЂСѓСЃР»Р° СЂР°СЃС‚РёС‚РµР»СЊРЅРѕСЃС‚СЊСЋ", 0.28)
    // 3. Р’РћР”РћРҐР РђРќРР›РР©Рђ Р Р”РђРњР‘Р«
    .basic("F15", "РџРµСЂРµРїРѕР»РЅРµРЅРёРµ РІРѕРґРѕС…СЂР°РЅРёР»РёС‰Р°", 0.2)
    .basic("F16", "Р Р°Р·СЂСѓС€РµРЅРёРµ РґР°РјР±С‹", 0.05)
    .basic("F17", "РџСЂРѕСЃР°С‡РёРІР°РЅРёРµ С‡РµСЂРµР· РґР°РјР±Сѓ", 0.15)
    .basic("F18", "РћС€РёР±РєРё СѓРїСЂР°РІР»РµРЅРёСЏ С€Р»СЋР·Р°РјРё", 0.18)
    .basic("F19", "РћС‚РєР°Р· Р°РІР°СЂРёР№РЅРѕРіРѕ СЃР±СЂРѕСЃР° РІРѕРґС‹", 0.1)
    .basic("F20", "РџРµСЂРµР»РёРІ С‡РµСЂРµР· РіСЂРµР±РµРЅСЊ РґР°РјР±С‹", 0.12)
    // 4. Р“РћР РћР”РЎРљРђРЇ РЎРРЎРўР•РњРђ
    .basic("F21", "Р—Р°СЃРѕСЂРµРЅРёРµ Р»РёРІРЅРµРІРѕР№ РєР°РЅР°Р»РёР·Р°С†РёРё", 0.45)
    .basic("F22", "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅР°СЏ РїСЂРѕРїСѓСЃРєРЅР°СЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚СЊ Р»РёРІРЅРµРІРєРё", 0.4)
    .basic("F23", "РћС‚РєР°Р· РЅР°СЃРѕСЃРЅС‹С… СЃС‚Р°РЅС†РёР№", 0.2)
    .basic("F24", "РћС‚РєР»СЋС‡РµРЅРёРµ СЌР»РµРєС‚СЂРѕСЌРЅРµСЂРіРёРё", 0.25)
    .basic("F25", "РћС€РёР±РєРё РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ РґСЂРµРЅР°Р¶Р°", 0.15)
    .basic("F26", "Р—Р°СЃС‚СЂРѕР№РєР° РїРѕР№РјС‹", 0.3)
    .basic("F27", "РђСЃС„Р°Р»СЊС‚РёСЂРѕРІР°РЅРёРµ (СЃРЅРёР¶РµРЅРёРµ РёРЅС„РёР»СЊС‚СЂР°С†РёРё)", 0.35)
    // 5. РђР’РўРћРњРђРўРРљРђ Р РўР•РҐРќРРљРђ
    .basic("F28", "РћС‚РєР°Р· РґР°С‚С‡РёРєРѕРІ СѓСЂРѕРІРЅСЏ РІРѕРґС‹", 0.2)
    .basic("F29", "РћС€РёР±РєР° СЃРёСЃС‚РµРјС‹ РјРѕРЅРёС‚РѕСЂРёРЅРіР°", 0.15)
    .basic("F30", "РЎР±РѕР№ СЃРёСЃС‚РµРјС‹ СѓРїСЂР°РІР»РµРЅРёСЏ РґР°РјР±РѕР№", 0.1)
    .basic("F31", "РћС€РёР±РєР° РѕРїРµСЂР°С‚РѕСЂР°", 0.2)//
    .basic("F32", "РћС‚РєР°Р· РЅР°СЃРѕСЃРѕРІ", 0.25)
    .basic("F33", "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕРµ РѕР±СЃР»СѓР¶РёРІР°РЅРёРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ", 0.3)
    // 6. Р§Р•Р›РћР’Р•Р§Р•РЎРљРР™ Р¤РђРљРўРћР
    .basic("F34", "РќР°СЂСѓС€РµРЅРёРµ СЂРµРіР»Р°РјРµРЅС‚РѕРІ", 0.2)
    .basic("F35", "РРіРЅРѕСЂРёСЂРѕРІР°РЅРёРµ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№", 0.15)
    .basic("F36", "РќРµСЃРІРѕРµРІСЂРµРјРµРЅРЅРѕРµ СЂРµР°РіРёСЂРѕРІР°РЅРёРµ", 0.25)
    .basic("F37", "РќРµР·Р°РєРѕРЅРЅС‹Рµ РґР°РјР±С‹/СЃРѕРѕСЂСѓР¶РµРЅРёСЏ", 0.18)
    .basic("F38", "Р’С‹СЂСѓР±РєР° Р»РµСЃРѕРІ", 0.3)
    .basic("F39", "Р—Р°СЃРѕСЂРµРЅРёРµ С‚РµСЂСЂРёС‚РѕСЂРёРё РѕС‚С…РѕРґР°РјРё", 0.35)
    // 7. Р“Р•РћР›РћР“РРЇ Р Р›РђРќР”РЁРђР¤Рў
    .basic("F40", "РћРїРѕР»Р·РЅРё РІ СЂСѓСЃР»Рµ", 0.1)
    .basic("F41", "РџСЂРѕСЃРµРґР°РЅРёРµ РіСЂСѓРЅС‚Р°", 0.12)
    .basic("F42", "Р’С‹СЃРѕРєРёР№ СѓСЂРѕРІРµРЅСЊ РіСЂСѓРЅС‚РѕРІС‹С… РІРѕРґ", 0.28)
    .basic("F43", "РќРёР·РєР°СЏ РІРїРёС‚С‹РІР°РµРјРѕСЃС‚СЊ РїРѕС‡РІС‹", 0.3)
    // 8. РљР›РРњРђРўРР§Р•РЎРљРР• Р¤РђРљРўРћР Р«
    .basic("F44", "РР·РјРµРЅРµРЅРёРµ РєР»РёРјР°С‚Р° (СЂРѕСЃС‚ РѕСЃР°РґРєРѕРІ)", 0.25)
    .basic("F45", "Р§Р°СЃС‚С‹Рµ СЌРєСЃС‚СЂРµРјР°Р»СЊРЅС‹Рµ РїРѕРіРѕРґРЅС‹Рµ СЃРѕР±С‹С‚РёСЏ", 0.2)
    // 9. Р Р•Р§РќРђРЇ РЎРРЎРўР•РњРђ
    .basic("F46", "РџРµСЂРµРїРѕР»РЅРµРЅРёРµ РїСЂРёС‚РѕРєРѕРІ", 0.3)
    .basic("F47", "РЎРёРЅС…СЂРѕРЅРЅС‹Рµ РїР°РІРѕРґРєРё РІ Р±Р°СЃСЃРµР№РЅРµ", 0.2)
    .basic("F48", "Р—Р°С‚РѕСЂ РІ СѓСЃС‚СЊРµ СЂРµРєРё", 0.18)
    // 10. РњРћР РЎРљРР• Р¤РђРљРўРћР Р«
    .basic("F49", "РџРѕРІС‹С€РµРЅРёРµ СѓСЂРѕРІРЅСЏ РјРѕСЂСЏ", 0.22)
    .basic("F50", "Р¦СѓРЅР°РјРё", 0.01)
    // 11. РђР’РђР РР
    .basic("F51", "Р Р°Р·СЂС‹РІ С‚СЂСѓР±РѕРїСЂРѕРІРѕРґР°", 0.1)
    .basic("F52", "РђРІР°СЂРёР№РЅС‹Р№ СЃР±СЂРѕСЃ РІРѕРґС‹", 0.15)
    .basic("F53", "Р Р°Р·СЂСѓС€РµРЅРёРµ РіРёРґСЂРѕСЃРѕРѕСЂСѓР¶РµРЅРёР№", 0.05)
    // 12. Р”РћРџРћР›РќРРўР•Р›Р¬РќР«Р•
    .basic("F54", "РќР°СЂСѓС€РµРЅРёРµ РІРѕРґРѕРѕС‚РІРµРґРµРЅРёСЏ", 0.3)
    .basic("F55", "РџРµСЂРµРіСЂСѓР·РєР° РґСЂРµРЅР°Р¶РЅРѕР№ СЃРёСЃС‚РµРјС‹", 0.35)
    .basic("F56", "РќРµРґРѕСЃС‚Р°С‚РѕРє СЂРµР·РµСЂРІРЅС‹С… СЃРёСЃС‚РµРј", 0.2)
    .basic("F57", "РћС€РёР±РєРё РїСЂРѕРіРЅРѕР·РёСЂРѕРІР°РЅРёСЏ РїРѕРіРѕРґС‹", 0.18)
    .basic("F58", "Р—Р°РїР°Р·РґС‹РІР°РЅРёРµ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№", 0.2)
    .basic("F59", "РћС‚РєР°Р· СЃРІСЏР·Рё", 0.15)
    .basic("F60", "РЎРЅРёР¶РµРЅРёРµ РїСЂРѕРїСѓСЃРєРЅРѕР№ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё РјРѕСЃС‚РѕРІ", 0.22)
    .basic("F61", "Р—Р°С‚РѕСЂ РїРѕРґ РјРѕСЃС‚Р°РјРё", 0.3)
    .basic("F62", "РЎРєРѕРїР»РµРЅРёРµ Р»СЊРґР°", 0.2)
    .basic("F63", "Р›РѕРєР°Р»СЊРЅС‹Рµ РїРѕРґС‚РѕРїР»РµРЅРёСЏ", 0.35)
    .basic("F64", "РџРµСЂРµР»РёРІ РєР°РЅР°Р»РѕРІ", 0.25)
    .basic("F65", "РќР°СЂСѓС€РµРЅРёРµ Р±РµСЂРµРіРѕР·Р°С‰РёС‚С‹", 0.2)
    .basic("F66", "РР·РЅРѕСЃ РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂС‹", 0.3)
    .basic("F67", "РќРµРґРѕСЃС‚Р°С‚РѕРє С„РёРЅР°РЅСЃРёСЂРѕРІР°РЅРёСЏ", 0.25)
    .basic("F68", "РћС€РёР±РєРё РїР»Р°РЅРёСЂРѕРІР°РЅРёСЏ РіРѕСЂРѕРґР°", 0.2)
    .basic("F69", "РџРµСЂРµРіСЂСѓР·РєР° РіРёРґСЂРѕСЃРёСЃС‚РµРјС‹", 0.28)
    .basic("F70", "РќРµРїСЂРµРґСЃРєР°Р·СѓРµРјС‹Рµ СЌРєСЃС‚СЂРµРјР°Р»СЊРЅС‹Рµ СЃРѕР±С‹С‚РёСЏ", 0.1)
    //
    .gate("G1", "РњРµС‚РµРѕСЂРѕР»РѕРіРёС‡РµСЃРєР°СЏ РЅР°РіСЂСѓР·РєР°", "OR")
    .gate("G2", "РџСЂРѕР±Р»РµРјС‹ СЂСѓСЃР»Р°", "OR")
    .gate("G3", "РћС‚РєР°Р· РґР°РјР± Рё РІРѕРґРѕС…СЂР°РЅРёР»РёС‰", "OR")
    .gate("G4", "Р“РѕСЂРѕРґСЃРєР°СЏ РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂР°", "OR")
    .gate("G5", "РћС‚РєР°Р·С‹ С‚РµС…РЅРёРєРё Рё Р°РІС‚РѕРјР°С‚РёРєРё", "OR")
    .gate("G6", "Р§РµР»РѕРІРµС‡РµСЃРєРёР№ С„Р°РєС‚РѕСЂ", "OR")
    .gate("G7", "Р“РµРѕР»РѕРіРёС‡РµСЃРєРёРµ С„Р°РєС‚РѕСЂС‹", "OR")
    .gate("G8", "РљР»РёРјР°С‚РёС‡РµСЃРєРёРµ С„Р°РєС‚РѕСЂС‹", "OR")
    .gate("G9", "Р РµС‡РЅР°СЏ РїРµСЂРµРіСЂСѓР·РєР°", "AND")
    .gate("G10", "РњРѕСЂСЃРєРѕРµ РІРѕР·РґРµР№СЃС‚РІРёРµ", "OR")
    .gate("G11", "РђРІР°СЂРёР№РЅС‹Рµ СЃРѕР±С‹С‚РёСЏ", "OR")
    .gate("G12", "РЎРёСЃС‚РµРјРЅР°СЏ РїРµСЂРµРіСЂСѓР·РєР°", "AND")
    .gate("G13", "РћР±С‰РµРµ РЅР°РІРѕРґРЅРµРЅРёРµ", "OR")
    // РњРµС‚РµРѕ
    .link("G1", "F1","F2","F3","F4","F5","F6","F7","F8")
    // Р СѓСЃР»Рѕ
    .link("G2", "F9","F10","F11","F12","F13","F14","F60","F61")
    // Р”Р°РјР±С‹
    .link("G3", "F15","F16","F17","F18","F19","F20","F53")
    // Р“РѕСЂРѕРґ
    .link("G4", "F21","F22","F23","F24","F25","F26","F27","F54","F55","F63","F64")
    // РўРµС…РЅРёРєР°
    .link("G5", "F28","F29","F30","F32","F33","F56","F59")
    // Р§РµР»РѕРІРµРє
    .link("G6", "F31","F34","F35","F36","F37","F38","F39","F67","F68")
    // Р“РµРѕР»РѕРіРёСЏ
    .link("G7", "F40","F41","F42","F43","F65","F66")
    // РљР»РёРјР°С‚
    .link("G8", "F44","F45","F70")
    // Р РµС‡РЅР°СЏ СЃРёСЃС‚РµРјР° (РєРѕРјР±РёРЅР°С†РёСЏ!)
    .link("G9", "F46","F47","F48","F62")
    // РњРѕСЂРµ
    .link("G10", "F49","F50")
    // РђРІР°СЂРёРё
    .link("G11", "F51","F52")
    // РЎРёСЃС‚РµРјРЅР°СЏ РїРµСЂРµРіСЂСѓР·РєР° (РєР»СЋС‡РµРІРѕР№ AND)
    .link("G12", "G1","G2","G4")
    // Р¤РёРЅР°Р»СЊРЅРѕРµ СЃРѕР±С‹С‚РёРµ
    .link("G13", "G3","G5","G6","G7","G8","G9","G10","G11","G12","F57","F58","F69")
    .build("G13");

// ==================== Р РђРЎРљР›РђР”РљРђ (LAYOUT) РЎ РџР Р•Р”РћРўР’Р РђР©Р•РќРР•Рњ РџР•Р Р•РЎР•Р§Р•РќРР™ ====================
const LEAF_W = 75;
const GATE_W = 75;
const H_GAP = 100;   // СѓРІРµР»РёС‡РµРЅ РґР»СЏ Р±РѕР»СЊС€РѕРіРѕ РґРµСЂРµРІР°
const V_GAP = 250;  // СѓРІРµР»РёС‡РµРЅ РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ РІРµСЂС‚РёРєР°Р»СЊРЅС‹С… РїРµСЂРµРєСЂС‹С‚РёР№
//const MARGIN = 0;

type Point = { x: number; y: number };

interface SubtreeLayout {
    width: number;
    positions: Map<string, Point>;
}

function getNodeWidth(node: JustNode): number {
    return node instanceof BasicEvent ? LEAF_W : GATE_W;
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
        let totalChildrenWidth = 0;
        for (let i = 0; i < childLayouts.length; i++) {
            totalChildrenWidth += childLayouts[i].width;
            if (i < childLayouts.length - 1) totalChildrenWidth += H_GAP;
        }
        const span = Math.max(totalChildrenWidth, GATE_W);

        const positions = new Map<string, Point>();
        let xCursor = (span - totalChildrenWidth) / 2;
        for (let i = 0; i < childLayouts.length; i++) {
            const cl = childLayouts[i];
            for (const [id, pos] of cl.positions) {
                positions.set(id, { x: pos.x + xCursor, y: pos.y });
            }
            xCursor += cl.width + H_GAP;
        }

        const parentX = span / 2 - GATE_W / 2;
        positions.set(node.id, { x: parentX, y });
        return { width: span, positions };
    }

    throw new Error("Unknown node type");
}

function shiftSubtree(nodeId: string, dx: number, positions: Map<string, Point>, root: JustNode) {
    const findNode = (n: JustNode): JustNode | null => {
        if (n.id === nodeId) return n;
        if (n instanceof GateNode) {
            for (const child of n.children) {
                const found = findNode(child);
                if (found) return found;
            }
        }
        return null;
    };
    const node = findNode(root);
    if (!node) return;

    const shiftRec = (n: JustNode) => {
        const pos = positions.get(n.id);
        if (pos) positions.set(n.id, { x: pos.x + dx, y: pos.y });
        if (n instanceof GateNode) {
            n.children.forEach(shiftRec);
        }
    };
    shiftRec(node);
}

function resolveCollisions(positions: Map<string, Point>, root: JustNode): Map<string, Point> {
    const byY = new Map<number, Array<{ id: string; x: number; node: JustNode }>>();
    const collectNodes = (node: JustNode) => {
        const pos = positions.get(node.id)!;
        if (!byY.has(pos.y)) byY.set(pos.y, []);
        byY.get(pos.y)!.push({ id: node.id, x: pos.x, node });
        if (node instanceof GateNode) node.children.forEach(collectNodes);
    };
    collectNodes(root);

    const newPositions = new Map(positions);
    for (const [, row] of byY.entries()) {
        row.sort((a, b) => a.x - b.x);
        for (let i = 0; i < row.length - 1; i++) {
            const current = row[i];
            const next = row[i + 1];
            const currentW = getNodeWidth(current.node);
            const overlap = current.x + currentW + H_GAP - next.x;
            if (overlap > 0) {
                shiftSubtree(next.id, overlap + 4, newPositions, root);
                next.x += 0;
            }
        }
    }
    return newPositions;
}

function layoutFaultTree(root: JustNode): Map<string, Point> {
    const { positions } = layoutSubtree(root, 0);
    let minX = Infinity, minY = Infinity;
    for (const p of positions.values()) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
    }
    if (Number.isFinite(minX)) {
        const dx = -minX;//+ MARGIN;
        const dy = -minY;// + MARGIN;
        for (const [id, p] of positions) {
            positions.set(id, { x: p.x + dx, y: p.y + dy });
        }
    }
    return resolveCollisions(positions, root);
}

// ==================== РџР Р•РћР‘Р РђР—РћР’РђРќРР• Р”Р•Р Р•Р’Рђ в†’ NODES + EDGES ====================
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
        node.children.forEach((child) =>
            collectEdges(child, node.id, edges, nextEdgeId)
        );
    }
}

type FaultTreeEventData = {
    code: string;
    name: string;
    probability: number;
};

type FaultTreeGateData = {
    code: string;
    name: string;
    gate: GateType;
};

type FaultTreeEventNodeType = Node<FaultTreeEventData, "faultEvent">;
type FaultTreeGateNodeType = Node<FaultTreeGateData, "faultGate">;

function flattenTree(root: JustNode): { nodes: Node[]; edges: Edge[] } {
    const positions = layoutFaultTree(root);
    const edges: Edge[] = [];
    collectEdges(root, undefined, edges, makeEdgeIdCounters());

    const nodes: Node[] = [];
    const placed = new Set<string>();

    const visit = (node: JustNode) => {
        const pos = positions.get(node.id) ?? { x: 0, y: 0 };

        if (node instanceof BasicEvent) {
            if (placed.has(node.id)) return;
            placed.add(node.id);
            nodes.push({
                id: node.id,
                type: "faultEvent",
                position: pos,
                data: {
                    code: node.id,
                    name: node.name,
                    probability: node.probability,
                } as FaultTreeEventData,
            });
            return;
        }

        if (node instanceof GateNode) {
            if (placed.has(node.id)) return;
            placed.add(node.id);
            nodes.push({
                id: node.id,
                type: "faultGate",
                position: pos,
                data: {
                    code: node.id,
                    name: node.name,
                    gate: node.gate,
                } as FaultTreeGateData,
            });
            node.children.forEach(visit);
        }
    };

    visit(root);
    return { nodes, edges };
}

// ==================== РљРћРќРўР•РљРЎРў Р Р•Р–РРњРђ РџРћР”РџРРЎР•Р™ ====================
type FaultTreeLabelMode = "id" | "name";
const FaultTreeLabelContext = createContext<FaultTreeLabelMode>("name");

// ==================== РљРћРњРџРћРќР•РќРўР« РЈР—Р›РћР’ ====================
const gateText = (g: GateType) => (g === "AND" ? "Р" : "РР›Р");

const GateSymbolAnd = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 56 44" width={56} height={44} aria-hidden>
        <path
            d="M 6 38 L 50 38 L 50 22 Q 50 6 28 6 Q 6 6 6 22 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
        />
        <line x1={10} y1={30} x2={46} y2={30} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
    </svg>
);

const GateSymbolOr = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 56 44" width={56} height={44} aria-hidden>
        <path
            d="M 6 38 L 28 8 L 50 38 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
        />
        <line x1={12} y1={32} x2={44} y2={32} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
);

const GateSymbol = ({ gate, className }: { gate: GateType; className?: string }) =>
    gate === "AND" ? <GateSymbolAnd className={className} /> : <GateSymbolOr className={className} />;

function PrimaryLabel({ code, name }: { code: string; name: string }) {
    const mode = useContext(FaultTreeLabelContext);
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

function FaultTreeEventNode({ data }: NodeProps<FaultTreeEventNodeType>) {
    return (
        <div className="ft-node ft-node--event">
            <Handle type="target" position={Position.Top} className="ft-handle" />
            <PrimaryLabel code={data.code} name={data.name} />
            <div className="ft-node__meta">p = {data.probability.toFixed(2)}</div>
            <Handle type="source" position={Position.Bottom} className="ft-handle" />
        </div>
    );
}

function FaultTreeGateNode({ data }: NodeProps<FaultTreeGateNodeType>) {
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

const nodeTypes: NodeTypes = {
    faultEvent: FaultTreeEventNode,
    faultGate: FaultTreeGateNode,
};

// ==================== Р“Р›РђР’РќР«Р™ РљРћРњРџРћРќР•РќРў РџРћРўРћРљРђ ====================
interface FaultTreeFlowProps {
    treeRoot: JustNode;
    labelMode: FaultTreeLabelMode;
}

const FaultTreeFlow: React.FC<FaultTreeFlowProps> = ({ treeRoot, labelMode }) => {
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
                    defaultEdgeOptions={{ type: "smoothstep" }}
                >
                    <Background gap={20} size={1} color="#cbd5e1" />
                    <Controls showInteractive={false} />
                </ReactFlow>
            </div>
        </FaultTreeLabelContext.Provider>
    );
};

// ==================== РЎРўР РђРќРР¦Рђ (APP) ====================
export default function App() {
    const [labelMode, setLabelMode] = useState<FaultTreeLabelMode>("name");
    const [slider, setSlider] = useState(1);
    const [displayRoot, setDisplayRoot] = useState<JustNode | null>(null);
    const [flowRevision, setFlowRevision] = useState(0);
    const [emptyHint, setEmptyHint] = useState(false);
    const treeCacheRef = useRef(new Map<string, JustNode>());

    useEffect(() => {
        const key = slider.toFixed(2);
        const cached = treeCacheRef.current.get(key);
        if (cached) {
            setDisplayRoot(cached);
            setEmptyHint(false);
            return;
        }
        const root = tryGenerateRoot(templateRoot, slider);
        if (root) {
            treeCacheRef.current.set(key, root);
            setDisplayRoot(root);
            setEmptyHint(false);
        } else {
            setDisplayRoot(null);
            setEmptyHint(true);
        }
    }, [slider]);

    const handleRandom = useCallback(() => {
        const key = slider.toFixed(2);
        const root = tryGenerateRoot(templateRoot, slider);
        if (root) {
            treeCacheRef.current.set(key, root);
            setDisplayRoot(root);
            setEmptyHint(false);
        } else {
            setDisplayRoot(null);
            setEmptyHint(true);
        }
        setFlowRevision((r) => r + 1);
    }, [slider]);

    return (
        <>
            <div className="graph-page">
                <header className="graph-page__header">
                    <div className="graph-page__header-row">
                        <h1 className="graph-page__title">Р“СЂР°С„ РѕС‚РєР°Р·РѕРІ РїРѕ РЅР°РІРѕРґРЅРµРЅРёСЏРј</h1>
                        <div className="graph-page__toolbar" role="group" aria-label="РџРѕРґРїРёСЃРё РІРµСЂС€РёРЅ">
                            <button
                                type="button"
                                className={`graph-page__toggle ${labelMode === "name" ? "graph-page__toggle--active" : ""}`}
                                onClick={() => setLabelMode("name")}
                            >
                                РќР°Р·РІР°РЅРёСЏ
                            </button>
                            <button
                                type="button"
                                className={`graph-page__toggle ${labelMode === "id" ? "graph-page__toggle--active" : ""}`}
                                onClick={() => setLabelMode("id")}
                            >
                                РљРѕРґС‹ (F1, G2вЂ¦)
                            </button>

                            <button type="button" className="graph-page__toggle" onClick={handleRandom}>
                                Random
                            </button>

                            <div style={{ padding: "6px 10px", minWidth: 180 }}>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={slider}
                                    onChange={(e) => setSlider(Number(e.target.value))}
                                    style={{ width: "100%" }}
                                    aria-label="Интенсивность (p · slider)"
                                />
                                <div style={{ fontSize: 12, marginTop: 4, color: "#64748b" }}>
                                    Интенсивность: {slider.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                <div className="graph-page__canvas">
                    {emptyHint && !displayRoot ? (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                padding: 24,
                                textAlign: "center",
                                color: "#64748b",
                            }}
                        >
                            Не удалось собрать непустой граф за несколько попыток. Увеличьте интенсивность (слайдер) или
                            нажмите Random.
                        </div>
                    ) : displayRoot ? (
                        <FaultTreeFlow
                            treeRoot={displayRoot}
                            labelMode={labelMode}
                            key={`${slider.toFixed(2)}-${flowRevision}`}
                        />
                    ) : null}
                </div>
            </div>
        <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body, #root {
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        body {
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        }
        .ft-node {
          position: relative;
          width: 158px;
          box-sizing: border-box;
          border-radius: 10px;
          padding: 8px 10px 10px;
          font-size: 11px;
          line-height: 1.25;
          text-align: center;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
        }
        .ft-node--event {
          border-color: #3b82f6;
          background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
        }
        .ft-node--gate {
          padding: 10px 8px 10px;
          border-width: 2px;
          width: 168px;
        }
        .ft-node--gate-and {
          border-color: #b45309;
          background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
        }
        .ft-node--gate-or {
          border-color: #6d28d9;
          background: linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%);
        }
        .ft-gate-symbol-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          margin-bottom: 6px;
        }
        .ft-gate-symbol {
          display: block;
        }
        .ft-gate-symbol--and {
          color: #92400e;
        }
        .ft-gate-symbol--or {
          color: #5b21b6;
        }
        .ft-gate-badge {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #64748b;
          text-transform: uppercase;
        }
        .ft-node__primary {
          font-weight: 600;
          color: #0f172a;
          font-size: 11px;
          word-break: break-word;
        }
        .ft-node__primary--mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          letter-spacing: 0.02em;
        }
        .ft-node__secondary {
          margin-top: 3px;
          font-size: 9px;
          line-height: 1.2;
          color: #64748b;
          word-break: break-word;
        }
        .ft-node__secondary--mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ft-node__meta {
          margin-top: 6px;
          font-variant-numeric: tabular-nums;
          color: #475569;
          font-size: 10px;
        }
        .ft-handle {
          width: 7px !important;
          height: 7px !important;
          border: 2px solid #fff !important;
          background: #64748b !important;
        }
        @media (prefers-color-scheme: dark) {
          .ft-node {
            background: #1e293b;
            border-color: rgba(148, 163, 184, 0.25);
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
          }
          .ft-node--event {
            border-color: #3b82f6;
            background: linear-gradient(180deg, #1e293b 0%, #172554 100%);
          }
          .ft-node--gate-and {
            border-color: #f59e0b;
            background: linear-gradient(180deg, #1c1917 0%, #422006 100%);
          }
          .ft-node--gate-or {
            border-color: #a78bfa;
            background: linear-gradient(180deg, #1e1b4b 0%, #312e81 100%);
          }
          .ft-node__primary {
            color: #f1f5f9;
          }
          .ft-node__secondary {
            color: #94a3b8;
          }
          .ft-node__meta {
            color: #cbd5e1;
          }
          .ft-gate-symbol--and {
            color: #fcd34d;
          }
          .ft-gate-symbol--or {
            color: #c4b5fd;
          }
          .ft-gate-badge {
            color: #94a3b8;
          }
        }
        .graph-page {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #f1f5f9;
        }
        @media (prefers-color-scheme: dark) {
          .graph-page {
            background: #0f1419;
          }
        }
        .graph-page__header {
          flex-shrink: 0;
          padding: 12px 12px 10px;
          border-bottom: 1px solid #e2e8f0;
          background: inherit;
        }
        .graph-page__header-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .graph-page__title {
          margin: 0;
          font-size: clamp(1.15rem, 2.5vw, 1.5rem);
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .graph-page__toolbar {
          display: inline-flex;
          border-radius: 8px;
          padding: 3px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .graph-page__toggle {
          cursor: pointer;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          font-family: inherit;
          color: #1e293b;
          background: transparent;
          transition: background 0.15s, color 0.15s;
        }
        .graph-page__toggle:hover {
          color: #0f172a;
          background: rgba(0, 0, 0, 0.04);
        }
        .graph-page__toggle--active {
          color: #0f172a;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        @media (prefers-color-scheme: dark) {
          .graph-page__header {
            border-bottom-color: #334155;
          }
          .graph-page__toolbar {
            background: #1e293b;
            border-color: #334155;
          }
          .graph-page__toggle {
            color: #cbd5e1;
          }
          .graph-page__toggle:hover {
            color: white;
            background: rgba(255,255,255,0.06);
          }
          .graph-page__toggle--active {
            color: white;
            background: #0f172a;
          }
        }
        .graph-page__canvas {
          flex: 1;
          min-height: 0;
          position: relative;
        }
        .fault-tree-flow {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .fault-tree-flow .react-flow {
          --xy-background-color: transparent;
        }
        .fault-tree-flow .react-flow__controls {
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
        }
      `}</style>
        </>
    );
}