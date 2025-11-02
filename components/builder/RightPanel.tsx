"use client"


import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { StylesTab } from "./tabs/StylesTab"
import { PropertiesTab } from "./tabs/PropertiesTab"
import { SidePanel } from "../petri/side-panel"
import { useStore } from "zustand";
import { useFocusedTabStore, useFocusedTabId } from "../../stores/pagebuilder/editor-context";
import { getFlowWorkspaceStore, type FlowWorkspaceEntity, type FlowWorkspaceStore } from "../../stores/petri/flow-editor-context";
import { X, GripVertical, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "../ui/button";
import type { EditorType } from "./MainPanel";

type RightPanelProps = {
	isOpen: boolean;
	onClose: () => void;
	onOpen: () => void;
	activeTab?: string;
	activeEditorType?: EditorType | null;
  isMaximized: boolean;
  onToggleMaximize: () => void;
};

// This hook subscribes to the flow store and returns the relevant state.
// It handles the case where the store might not exist for the current tab.
const useFlowSelection = (store: FlowWorkspaceStore | null): { selectedEntity: FlowWorkspaceEntity | null, sidePanelDetail: any | null } => {
  const [selection, setSelection] = React.useState<{ selectedEntity: FlowWorkspaceEntity | null, sidePanelDetail: any | null }>({ selectedEntity: null, sidePanelDetail: null });

  React.useEffect(() => {
    if (!store) {
      setSelection({ selectedEntity: null, sidePanelDetail: null });
      return;
    }

    // Set initial state from the store
    const initialState = store.getState();
    setSelection({
      selectedEntity: initialState.selectedEntity,
      sidePanelDetail: initialState.sidePanelDetail,
    });

    // Subscribe to future changes
    const unsubscribe = store.subscribe((state) => {
      setSelection({
        selectedEntity: state.selectedEntity,
        sidePanelDetail: state.sidePanelDetail,
      });
    });

    return unsubscribe;
  }, [store]);

  return selection;
};

export const RightPanel: React.FC<RightPanelProps> = ({ isOpen, onClose, onOpen, activeTab, activeEditorType, isMaximized, onToggleMaximize }) => {
		const focusedTabId = useFocusedTabId();
		const pageStore = useFocusedTabStore();
		const flowStore = focusedTabId ? getFlowWorkspaceStore(focusedTabId) ?? null : null;
		const isWorkflowEditor = activeEditorType === 'workflow';

		const selectedElementId = useStore(pageStore, (state) => state.selectedElementId);
		const { selectedEntity: workflowSelection, sidePanelDetail: workflowSidePanelProps } = useFlowSelection(isWorkflowEditor ? flowStore : null);

	if (!isOpen) return null;

	const headerLabel = isWorkflowEditor
			? (workflowSelection ? 'Workflow' : 'No Selection')
		: (selectedElementId ? "Element" : "No Selection");
  const containerClasses = [
    "bg-background border-l border-border h-full flex flex-col relative",
    isMaximized ? "w-full max-w-none" : "min-w-[200px] max-w-[600px]"
  ].join(' ');

	return (
		<div className={containerClasses}>
			{/* visual resizer knob to match flow-workspace style (non-interactive) */}
			{!isMaximized ? (
				<div role="presentation" className="pointer-events-none absolute left-[-6px] top-1/2 -translate-y-1/2 rounded-full bg-neutral-200 p-0.5">
					<GripVertical className="h-3 w-3 text-neutral-500" />
				</div>
			) : null}
			{/* Reusable header bar (match side-panel style) */}
			<div className="flex items-center justify-between border-b px-3 py-2">
				<div className="text-sm font-semibold">{headerLabel}</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={onToggleMaximize}
						title={isMaximized ? "Restore panel" : "Maximize panel"}
					>
						{isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
					</Button>
					<Button variant="ghost" size="icon" onClick={onClose} title="Close panel">
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>
			{isWorkflowEditor && workflowSidePanelProps ? (
				<div className="flex-1 overflow-hidden">
					<SidePanel {...workflowSidePanelProps} />
				</div>
			) : isWorkflowEditor ? (
				<div className="flex-1 flex items-center justify-center">
					<div className="p-4 text-center text-muted-foreground">
						{workflowSelection ? 'Loading selection details…' : 'Select a workflow entity to edit its properties'}
					</div>
				</div>
			) : selectedElementId ? (
				<Tabs defaultValue="styles" className="flex flex-col h-full">
					<TabsList className="grid w-full grid-cols-2 m-2">
						<TabsTrigger value="styles">Styles</TabsTrigger>
						<TabsTrigger value="properties">Properties</TabsTrigger>
					</TabsList>
					<TabsContent value="styles" className="flex-1 overflow-hidden">
						<StylesTab />
					</TabsContent>
					<TabsContent value="properties" className="flex-1 overflow-hidden">
						<PropertiesTab />
					</TabsContent>
				</Tabs>
			) : (
				<div className="flex-1 flex items-center justify-center">
					<div className="p-4 text-center text-muted-foreground">Select an element to edit its properties</div>
				</div>
			)}
		</div>
	);
};
