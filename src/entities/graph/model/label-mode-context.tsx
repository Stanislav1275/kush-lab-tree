import { createContext, useContext } from "react";

export type FaultTreeLabelMode = "id" | "name";

export const FaultTreeLabelContext = createContext<FaultTreeLabelMode>("name");

export function useFaultTreeLabelMode(): FaultTreeLabelMode {
    return useContext(FaultTreeLabelContext);
}
