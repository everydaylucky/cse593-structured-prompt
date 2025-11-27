"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getAvailableParsers,
  getFreeParsers,
  type PDFParserConfig,
} from "@/lib/pdf-parsers/registry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PDFParserSelectorProps {
  selectedParserId?: string;
  onSelect: (parserId: string) => void;
  className?: string;
}

export function PDFParserSelector({
  selectedParserId,
  onSelect,
  className,
}: PDFParserSelectorProps) {
  const [parsers, setParsers] = useState<PDFParserConfig[]>([]);
  const [selectedParser, setSelectedParser] = useState<PDFParserConfig | null>(
    null
  );

  useEffect(() => {
    // 获取可用解析器
    const available = getAvailableParsers();
    setParsers(available);

    // 设置选中的解析器
    if (selectedParserId) {
      const parser = available.find((p) => p.id === selectedParserId);
      if (parser) {
        setSelectedParser(parser);
      }
    } else if (available.length > 0) {
      // 默认选择第一个免费解析器，或第一个可用解析器
      const freeParser = available.find((p) => p.free);
      setSelectedParser(freeParser || available[0]);
      onSelect(freeParser?.id || available[0].id);
    }
  }, [selectedParserId, onSelect]);

  const handleSelect = (parser: PDFParserConfig) => {
    setSelectedParser(parser);
    onSelect(parser.id);
  };

  if (parsers.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("w-full justify-between", className)}
        >
          <span className="flex items-center gap-2">
            {selectedParser && (
              <>
                <span>{selectedParser.free ? "🆓" : "⭐"}</span>
                <span className="text-sm">{selectedParser.name}</span>
              </>
            )}
            {!selectedParser && <span>Select Parser</span>}
          </span>
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {parsers.map((parser) => (
          <DropdownMenuItem
            key={parser.id}
            onClick={() => handleSelect(parser)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-1">
              <span>{parser.free ? "🆓" : "⭐"}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{parser.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {parser.description}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      parser.quality === "high"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : parser.quality === "medium"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    )}
                  >
                    {parser.quality} quality
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {parser.speed} speed
                  </span>
                </div>
              </div>
            </div>
            {selectedParser?.id === parser.id && (
              <Check className="size-4 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

