import { useState } from "react";
import "./graph-page.css";
import { FaultTreeFlow } from "../../features/react-flow-gpaph/model/render.tsx";
import { tree } from "../../entities/graph/model/const.ts";
import type { FaultTreeLabelMode } from "../../entities/graph/model/label-mode-context.tsx";

export const GraphPage = () => {
    const [labelMode, setLabelMode] = useState<FaultTreeLabelMode>("name");

    return (
        <div className="graph-page">
            <header className="graph-page__header">
                <div className="graph-page__header-row">
                    <h1 className="graph-page__title">Граф отказов по наводнениям</h1>
                    <div className="graph-page__toolbar" role="group" aria-label="Подписи вершин">
                        <button
                            type="button"
                            className={`graph-page__toggle ${labelMode === "name" ? "graph-page__toggle--active" : ""}`}
                            onClick={() => setLabelMode("name")}
                        >
                            Названия
                        </button>
                        <button
                            type="button"
                            className={`graph-page__toggle ${labelMode === "id" ? "graph-page__toggle--active" : ""}`}
                            onClick={() => setLabelMode("id")}
                        >
                            Коды (F1, G2…)
                        </button>
                    </div>
                </div>
            </header>
            <div className="graph-page__canvas">
                <FaultTreeFlow treeRoot={tree.root} labelMode={labelMode} />
            </div>
        </div>
    );
};
