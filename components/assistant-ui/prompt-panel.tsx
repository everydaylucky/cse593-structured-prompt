"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, ArrowLeft, Loader2, BookOpen, Download, Upload, Trash2, ChevronDown, Pencil } from "lucide-react";
import { PromptCard } from "./prompt-card";
import type { SummarySnapshot } from "./prompt-card";
import { useAssistantApi } from "@assistant-ui/react";
import { Button } from "../ui/button";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import {
  Panel,
  PanelTrigger,
  PanelExpandTrigger,
  PanelResizer,
} from "../ui/panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { PROMPT_COLLECT_EVENT, type PromptCollectDetail } from "@/lib/prompt-collector";
import { useIsMobile } from "@/hooks/use-mobile";
import initialPrompts from "@/data/initial.json";
import {
  type PromptItem,
  type PromptCollection,
  getCollections,
  getCurrentCollectionId,
  setCurrentCollectionId,
  createCollection,
  getCollection,
  updateCollection,
  addCollection,
  deleteCollection,
  exportCollection,
  importCollection,
  exportAllCollections,
  importAllCollections,
} from "@/lib/prompt-storage";

interface PromptPanelProps {
  onWidthChange?: (width: number) => void;
}

const PANEL_FLOATING = true;
const PANEL_DEFAULT_WIDTH = 320;
const PANEL_MIN_WIDTH = 260;
const PANEL_MAX_WIDTH_RATIO = 2 / 3;
const PANEL_MAX_WIDTH_FALLBACK = 500;

const getPanelMaxWidth = (isMobile: boolean) => {
  if (typeof window === "undefined") {
    return PANEL_MAX_WIDTH_FALLBACK;
  }

  const viewportWidth = window.innerWidth;
  return isMobile
    ? viewportWidth
    : Math.round(viewportWidth * PANEL_MAX_WIDTH_RATIO);
};

const clampPanelWidth = (value: number, maxWidth: number) =>
  Math.min(Math.max(value, PANEL_MIN_WIDTH), maxWidth);

export function PromptPanel(props: PromptPanelProps = {}) {
  const { onWidthChange } = props;
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [panelMaxWidth, setPanelMaxWidth] = useState(() => getPanelMaxWidth(isMobile));
  const [panelWidth, setPanelWidth] = useState(() => {
    const maxWidth = getPanelMaxWidth(isMobile);
    return isMobile ? maxWidth : clampPanelWidth(PANEL_DEFAULT_WIDTH, maxWidth);
  });
  const api = useAssistantApi();
  const threadRuntime = api.thread();
  
  const [collections, setCollections] = useState<PromptCollection[]>(() => {
    const stored = getCollections();
    if (stored.length === 0) {
      const defaultCollection = createCollection("Default", initialPrompts as PromptItem[]);
      addCollection(defaultCollection);
      setCurrentCollectionId(defaultCollection.id);
      return [defaultCollection];
    }
    return stored;
  });
  
  const [currentCollectionId, setCurrentCollectionIdState] = useState<string | null>(() => {
    const storedId = getCurrentCollectionId();
    if (storedId && getCollection(storedId)) {
      return storedId;
    }
    const firstId = collections.length > 0 ? collections[0].id : null;
    if (firstId) {
      setCurrentCollectionId(firstId);
    }
    return firstId;
  });
  
  const currentCollection = currentCollectionId ? getCollection(currentCollectionId) : null;
  const [prompts, setPrompts] = useState<PromptItem[]>(() => 
    currentCollection?.prompts ?? (initialPrompts as PromptItem[])
  );
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveCurrentCollection = useCallback(() => {
    if (!currentCollectionId) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      updateCollection(currentCollectionId, { prompts });
      setCollections(getCollections());
    }, 300);
  }, [currentCollectionId, prompts]);

  useEffect(() => {
    saveCurrentCollection();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [prompts, saveCurrentCollection]);

  useEffect(() => {
    if (currentCollectionId && currentCollection) {
      setPrompts(currentCollection.prompts);
    }
  }, [currentCollectionId]);

  const addPrompt = () => {
    const newPrompt: PromptItem = {
      id: Date.now().toString(),
      title: "New prompt",
      content: [],
      isEditing: false,
      isIncluded: true,
    };
    setPrompts([...prompts, newPrompt]);
  };

  const deletePrompt = (id: string) => {
    setPrompts(prevPrompts => prevPrompts.filter(p => p.id !== id));
  };

  const updatePrompt = useCallback((id: string, data: { title: string; content: string[] }) => {
    setPrompts(prevPrompts => prevPrompts.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const updateSummarySnapshot = useCallback((id: string, snapshot?: SummarySnapshot) => {
    setPrompts(prevPrompts =>
      prevPrompts.map(p => (
        p.id === id
          ? { ...p, summarySnapshot: snapshot === null ? undefined : snapshot }
          : p
      )),
    );
  }, []);

  const sendAllPrompts = async () => {
    setPrompts(prompts.map(p => ({ ...p, isEditing: false })));

    let message = `You will now receive a unified set of structured instructions.
They are organized into titled sections. Each section contains
bullet points that define requirements, constraints, or examples.

Interpret every section as part of one cohesive prompt.
Titles are for organization only — not separate tasks.

After reading all sections, follow the FINAL INSTRUCTION section.
Do not repeat or restate the instructions unless explicitly asked.

`;
    prompts.forEach((prompt) => {
      // Only include included prompts
      if (!prompt.isIncluded) {
        return;
      }
      message += "[" + (prompt.title || "") + "]\n";
      if (prompt.content.length > 0) {
        prompt.content.forEach(item => {
          message += "  - " + item + "\n";
        });
      }
      message += "\n";
    });

    message += `[FINAL INSTRUCTION]
Generate your response and follow all instructions above.`;

    setIsSending(true);
    try {
      threadRuntime.composer.setText(message);
      await threadRuntime.composer.send();
    } finally {
      setIsSending(false);
      if (isMobile) {
        setIsOpen(false);
      }
    }
  };

  const updateEditingState = (id: string, isEditing: boolean) => {
    setPrompts(prevPrompts => prevPrompts.map(p => p.id === id ? { ...p, isEditing } : p));
  };

  const updateIncludeState = (id: string, isIncluded: boolean) => {
    setPrompts(prevPrompts => prevPrompts.map(p => p.id === id ? { ...p, isIncluded } : p));
  };

  const handleCreateCollection = () => {
    const name = prompt("Enter collection name:", "New Collection");
    if (!name || !name.trim()) return;
    
    const newCollection = createCollection(name.trim());
    addCollection(newCollection);
    setCollections(getCollections());
    setCurrentCollectionId(newCollection.id);
    setCurrentCollectionIdState(newCollection.id);
    setPrompts([]);
  };

  const handleSwitchCollection = (id: string) => {
    setCurrentCollectionId(id);
    setCurrentCollectionIdState(id);
    const collection = getCollection(id);
    if (collection) {
      setPrompts(collection.prompts);
    }
  };

  const handleRenameCollection = (id: string) => {
    const collection = getCollection(id);
    if (!collection) return;
    
    const newName = prompt("Enter new collection name:", collection.name);
    if (!newName || !newName.trim() || newName === collection.name) return;
    
    updateCollection(id, { name: newName.trim() });
    setCollections(getCollections());
    if (id === currentCollectionId) {
      setCurrentCollectionIdState(id);
    }
  };

  const handleDeleteCollection = (id: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return;
    deleteCollection(id);
    setCollections(getCollections());
    const remaining = getCollections();
    if (remaining.length > 0) {
      handleSwitchCollection(remaining[0].id);
    } else {
      const defaultCollection = createCollection("Default", []);
      addCollection(defaultCollection);
      setCollections([defaultCollection]);
      setCurrentCollectionId(defaultCollection.id);
      setCurrentCollectionIdState(defaultCollection.id);
      setPrompts([]);
    }
  };

  const handleExportCollection = () => {
    if (!currentCollection) return;
    const json = exportCollection(currentCollection);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentCollection.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const json = exportAllCollections();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `structify_collections_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCollection = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const imported = importCollection(text);
        if (imported) {
          addCollection(imported);
          setCollections(getCollections());
          handleSwitchCollection(imported.id);
        } else {
          alert("Failed to import collection. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleImportAll = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (importAllCollections(text)) {
          setCollections(getCollections());
          alert("Collections imported successfully!");
        } else {
          alert("Failed to import collections. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      const nextMaxWidth = getPanelMaxWidth(isMobile);
      setPanelMaxWidth(nextMaxWidth);
      setPanelWidth((prevWidth) =>
        isMobile ? nextMaxWidth : clampPanelWidth(prevWidth, nextMaxWidth),
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isMobile]);

  useEffect(() => {
    const handleCollect = (event: Event) => {
      const detail = (event as CustomEvent<PromptCollectDetail>).detail;
      if (!detail || detail.content.length === 0) {
        return;
      }

      setPrompts(prevPrompts => [
        ...prevPrompts,
        {
          id: `${detail.messageId}-${Date.now()}`,
          title: detail.title,
          content: detail.content,
          isEditing: false,
          isIncluded: true,
        },
      ]);
      setIsOpen(true);
    };

    window.addEventListener(PROMPT_COLLECT_EVENT, handleCollect);
    return () => {
      window.removeEventListener(PROMPT_COLLECT_EVENT, handleCollect);
    };
  }, []);

  useEffect(() => {
    onWidthChange?.(isOpen ? panelWidth : 0);
  }, [isOpen, panelWidth, onWidthChange]);

  useEffect(() => {
    return () => {
      onWidthChange?.(0);
    };
  }, [onWidthChange]);

  return (
    <>
      <PanelExpandTrigger
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
      />
      <Panel open={isOpen} floating={PANEL_FLOATING} width={panelWidth}>
        <PanelResizer
          open={isOpen}
          width={panelWidth}
          minWidth={PANEL_MIN_WIDTH}
          maxWidth={panelMaxWidth}
          onResize={(nextWidth) =>
            setPanelWidth(clampPanelWidth(nextWidth, panelMaxWidth))
          }
        />
        <div className="flex h-full flex-col px-4 pb-4 pt-2">
          <SidebarHeader className="flex items-center gap-2 px-0 pb-4">
            <SidebarMenu className="flex-row items-center gap-2 w-full">
              <SidebarMenuItem className="w-auto">
                <PanelTrigger
                  onClick={() => setIsOpen(false)}
                  srLabel="Close prompt panel"
                />
              </SidebarMenuItem>
              <SidebarMenuItem className="flex-1 min-w-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="w-full justify-between px-3 font-semibold"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <BookOpen className="size-4 shrink-0" />
                        <span className="truncate text-xl">
                          {currentCollection?.name || "Structured Prompts"}
                        </span>
                      </div>
                      <ChevronDown className="size-4 shrink-0" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Collections</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {collections.map((collection) => (
                      <div key={collection.id} className="flex items-center gap-1">
                        <DropdownMenuItem
                          onClick={() => handleSwitchCollection(collection.id)}
                          className={currentCollectionId === collection.id ? "bg-accent flex-1" : "flex-1"}
                        >
                          <span className="truncate">{collection.name}</span>
                        </DropdownMenuItem>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameCollection(collection.id);
                          }}
                          title="Rename collection"
                        >
                          <Pencil className="size-3" />
                        </button>
                        {collections.length > 1 && (
                          <button
                            type="button"
                            className="mr-2 flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCollection(collection.id);
                            }}
                            title="Delete collection"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCreateCollection}>
                      <Plus className="size-4 mr-2" />
                      New Collection
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportCollection}>
                      <Download className="size-4 mr-2" />
                      Export Current
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportAll}>
                      <Download className="size-4 mr-2" />
                      Export All
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleImportCollection}>
                      <Upload className="size-4 mr-2" />
                      Import Collection
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleImportAll}>
                      <Upload className="size-4 mr-2" />
                      Import All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {prompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                id={prompt.id}
                title={prompt.title}
                content={prompt.content}
                isEditing={prompt.isEditing}
                onDelete={deletePrompt}
                onUpdate={updatePrompt}
                onEditingChange={(isEditing) => updateEditingState(prompt.id, isEditing)}
                isIncluded={prompt.isIncluded}
                onIncludeChange={(isIncluded) => updateIncludeState(prompt.id, isIncluded)}
                summarySnapshot={prompt.summarySnapshot}
                onSummarySnapshotChange={updateSummarySnapshot}
              />
            ))}
          </div>

          <Button
            onClick={addPrompt}
            variant="outline"
            className="mt-4 flex items-center justify-center rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 p-3 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-200 dark:hover:bg-yellow-900/40"
          >
            <Plus className="size-6 text-yellow-600" />
          </Button>

          <Button
            onClick={sendAllPrompts}
            disabled={isSending || prompts.filter(p => p.isIncluded).length === 0}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-yellow-500 p-3 text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ArrowLeft className="size-5" />
            )}
            <span>{isSending ? "Sending…" : "Send all prompts"}</span>
          </Button>
        </div>
      </Panel>
    </>
  );
}

