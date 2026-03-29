import type { GateType } from "../../../shared/lib/tree/model/tree.ts";

/** МЭК-подобный вентиль И: плоское основание, дуга сверху, горизонтальная черта (входы). */
export function GateSymbolAnd({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 56 44"
            width={56}
            height={44}
            aria-hidden
        >
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
}

/** Вентиль ИЛИ: «домик» / заострённая дуга (типичное обозначение в деревьях отказов). */
export function GateSymbolOr({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 56 44"
            width={56}
            height={44}
            aria-hidden
        >
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
}

export function GateSymbol({ gate, className }: { gate: GateType; className?: string }) {
    return gate === "AND" ? <GateSymbolAnd className={className} /> : <GateSymbolOr className={className} />;
}
