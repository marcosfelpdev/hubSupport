import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  AttachedMediaItem,
  InterleavedBlock,
  parseEditorDomToInterleaved,
  createAttachedMediaItem,
} from "@/lib/inline-media-parser";

export interface InlineMediaEditorProps {
  id?: string;
  mediaMap: Map<string, AttachedMediaItem>;
  onMediaAdded?: (item: AttachedMediaItem) => void;
  onChange?: (
    plainText: string,
    interleaved: InterleavedBlock[],
    insertedMediaIds: Set<string>
  ) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export interface InlineMediaEditorRef {
  removeChip(mediaId: string): void;
  insertMedia(mediaId: string): void;
  clear(): void;
  getInterleaved(): InterleavedBlock[];
  getPlainText(): string;
  focus(): void;
}

interface DropCursorPosition {
  top: number;
  left: number;
  height: number;
}

function getCaretRangeFromPoint(clientX: number, clientY: number): Range | null {
  if (typeof document.caretRangeFromPoint === "function") {
    return document.caretRangeFromPoint(clientX, clientY);
  }
  const docAny = document as any;
  if (typeof docAny.caretPositionFromPoint === "function") {
    const pos = docAny.caretPositionFromPoint(clientX, clientY);
    if (pos && pos.offsetNode) {
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      return range;
    }
  }
  return null;
}

function createChipElement(item: AttachedMediaItem): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.setAttribute("data-media-id", item.id);
  chip.setAttribute("data-filename", item.name);
  chip.setAttribute("data-mimetype", item.mimeType);
  chip.className =
    "inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-0.5 rounded-lg text-xs font-medium " +
    "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 " +
    "border border-slate-300 dark:border-slate-700 select-none align-middle shadow-2xs group cursor-default";

  // Ícone ou miniatura
  if (item.mimeType.startsWith("image/") && item.previewUrl) {
    const img = document.createElement("img");
    img.src = item.previewUrl;
    img.alt = item.name;
    img.className = "w-4 h-4 rounded object-cover shrink-0";
    chip.appendChild(img);
  } else {
    const iconSpan = document.createElement("span");
    iconSpan.className =
      "w-4 h-4 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400";
    if (item.mimeType === "application/pdf") {
      iconSpan.innerHTML = `<svg class="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    } else if (item.mimeType.startsWith("video/")) {
      iconSpan.innerHTML = `<svg class="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
    } else {
      iconSpan.innerHTML = `<svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`;
    }
    chip.appendChild(iconSpan);
  }

  // Nome do arquivo
  const nameSpan = document.createElement("span");
  nameSpan.className = "max-w-[120px] sm:max-w-[160px] truncate";
  nameSpan.textContent = item.name;
  chip.appendChild(nameSpan);

  // Botão de remoção individual do texto
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.setAttribute("data-action", "remove-chip");
  removeBtn.title = `Remover ${item.name} do texto`;
  removeBtn.className =
    "opacity-60 hover:opacity-100 hover:text-rose-500 transition-opacity p-0.5 ml-0.5 rounded cursor-pointer";
  removeBtn.innerHTML = `<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  chip.appendChild(removeBtn);

  return chip;
}

function insertChipAtRange(container: HTMLElement, range: Range, item: AttachedMediaItem) {
  // Se chip com este ID já existir no container, remove antes para evitar duplicação
  const existing = container.querySelector(`[data-media-id="${item.id}"]`);
  if (existing) {
    existing.remove();
  }

  range.deleteContents();
  const chipEl = createChipElement(item);
  range.insertNode(chipEl);

  // Insere um espaço em texto após o chip para garantir que o caret possa navegar livremente
  const spaceNode = document.createTextNode(" ");
  chipEl.parentNode?.insertBefore(spaceNode, chipEl.nextSibling);

  // Move o caret para logo após o espaço
  const sel = window.getSelection();
  if (sel) {
    const newRange = document.createRange();
    newRange.setStartAfter(spaceNode);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}

function insertChipAtEnd(container: HTMLElement, item: AttachedMediaItem) {
  const existing = container.querySelector(`[data-media-id="${item.id}"]`);
  if (existing) {
    existing.remove();
  }

  const chipEl = createChipElement(item);
  container.appendChild(chipEl);

  const spaceNode = document.createTextNode(" ");
  container.appendChild(spaceNode);
}

export const InlineMediaEditor = forwardRef<InlineMediaEditorRef, InlineMediaEditorProps>(
  function InlineMediaEditor(
    {
      id,
      mediaMap,
      onMediaAdded,
      onChange,
      disabled = false,
      placeholder = "Descreva a solicitação, incidente e ações tomadas...",
      minHeight = "120px",
      className = "",
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [dropCursor, setDropCursor] = useState<DropCursorPosition | null>(null);

    const handleContentChange = useCallback(() => {
      if (!containerRef.current) return;
      const parsed = parseEditorDomToInterleaved(containerRef.current, mediaMap);
      const empty = parsed.plainText.length === 0 && parsed.insertedMediaIds.size === 0;
      setIsEmpty(empty);
      onChange?.(parsed.plainText, parsed.interleaved, parsed.insertedMediaIds);
    }, [mediaMap, onChange]);

    useImperativeHandle(
      ref,
      () => ({
        removeChip: (mediaId: string) => {
          if (!containerRef.current) return;
          const chips = containerRef.current.querySelectorAll(`[data-media-id="${mediaId}"]`);
          chips.forEach((c) => c.remove());
          handleContentChange();
        },
        insertMedia: (mediaId: string) => {
          if (!containerRef.current) return;
          const item = mediaMap.get(mediaId);
          if (!item) return;

          const sel = window.getSelection();
          let range: Range | null = null;
          if (
            sel &&
            sel.rangeCount > 0 &&
            containerRef.current.contains(sel.getRangeAt(0).startContainer)
          ) {
            range = sel.getRangeAt(0);
          }

          if (range) {
            insertChipAtRange(containerRef.current, range, item);
          } else {
            insertChipAtEnd(containerRef.current, item);
          }
          handleContentChange();
        },
        clear: () => {
          if (!containerRef.current) return;
          containerRef.current.innerHTML = "";
          handleContentChange();
        },
        getInterleaved: () => {
          if (!containerRef.current) return [];
          return parseEditorDomToInterleaved(containerRef.current, mediaMap).interleaved;
        },
        getPlainText: () => {
          if (!containerRef.current) return "";
          return parseEditorDomToInterleaved(containerRef.current, mediaMap).plainText;
        },
        focus: () => {
          containerRef.current?.focus();
        },
      }),
      [mediaMap, handleContentChange]
    );

    // Click handler para delegar remoção de chip via botão '×'
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const removeBtn = target.closest('[data-action="remove-chip"]');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const chip = removeBtn.closest("[data-media-id]");
        if (chip) {
          chip.remove();
          handleContentChange();
        }
      }
    };

    // Navegação atômica e exclusão via teclado
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
      const range = sel.getRangeAt(0);

      // Backspace: se estiver logo após um chip, remove o chip inteiro atomicamente
      if (e.key === "Backspace") {
        let chipToDelete: HTMLElement | null = null;

        if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
          const prev = range.startContainer.previousSibling as HTMLElement;
          if (prev && prev.nodeType === Node.ELEMENT_NODE && prev.hasAttribute("data-media-id")) {
            chipToDelete = prev;
          }
        } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
          if (range.startOffset > 0) {
            const prev = range.startContainer.childNodes[range.startOffset - 1] as HTMLElement;
            if (prev && prev.nodeType === Node.ELEMENT_NODE && prev.hasAttribute("data-media-id")) {
              chipToDelete = prev;
            }
          }
        }

        if (chipToDelete) {
          e.preventDefault();
          chipToDelete.remove();
          handleContentChange();
          return;
        }
      }

      // Delete: se estiver logo antes de um chip, remove o chip inteiro atomicamente
      if (e.key === "Delete") {
        let chipToDelete: HTMLElement | null = null;

        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          const textLen = range.startContainer.textContent?.length || 0;
          if (range.startOffset === textLen) {
            const next = range.startContainer.nextSibling as HTMLElement;
            if (next && next.nodeType === Node.ELEMENT_NODE && next.hasAttribute("data-media-id")) {
              chipToDelete = next;
            }
          }
        } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
          const next = range.startContainer.childNodes[range.startOffset] as HTMLElement;
          if (next && next.nodeType === Node.ELEMENT_NODE && next.hasAttribute("data-media-id")) {
            chipToDelete = next;
          }
        }

        if (chipToDelete) {
          e.preventDefault();
          chipToDelete.remove();
          handleContentChange();
          return;
        }
      }
    };

    // Drag Over com Drop Cursor
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";

      if (!containerRef.current) return;
      const range = getCaretRangeFromPoint(e.clientX, e.clientY);

      if (range && containerRef.current.contains(range.startContainer)) {
        const rects = range.getClientRects();
        const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        if (rect && rect.height > 0) {
          setDropCursor({
            top: rect.top - containerRect.top + containerRef.current.scrollTop,
            left: rect.left - containerRect.left + containerRef.current.scrollLeft,
            height: rect.height,
          });
          return;
        }
      }

      // Fallback para posicionamento do cursor
      const containerRect = containerRef.current.getBoundingClientRect();
      setDropCursor({
        top: Math.max(10, e.clientY - containerRect.top + containerRef.current.scrollTop - 10),
        left: Math.max(10, e.clientX - containerRect.left + containerRef.current.scrollLeft),
        height: 20,
      });
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.relatedTarget as Node)) {
        setDropCursor(null);
      }
    };

    // Drop handler
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDropCursor(null);

      if (!containerRef.current) return;
      const dropRange = getCaretRangeFromPoint(e.clientX, e.clientY);

      // 1. Drag interno de mídia existente (da lista inferior do formulário)
      const internalMediaId = e.dataTransfer.getData("application/x-hubsupport-media-id");
      if (internalMediaId) {
        const item = mediaMap.get(internalMediaId);
        if (item) {
          if (dropRange && containerRef.current.contains(dropRange.startContainer)) {
            insertChipAtRange(containerRef.current, dropRange, item);
          } else {
            insertChipAtEnd(containerRef.current, item);
          }
          handleContentChange();
        }
        return;
      }

      // 2. Arquivos locais do SO soltos no texto
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
          const item = createAttachedMediaItem(file);
          mediaMap.set(item.id, item);
          onMediaAdded?.(item);

          if (dropRange && containerRef.current.contains(dropRange.startContainer)) {
            insertChipAtRange(containerRef.current, dropRange, item);
          } else {
            insertChipAtEnd(containerRef.current, item);
          }
        }
        handleContentChange();
      }
    };

    // Paste handler para interceptar prints (Ctrl+V) ou colar texto limpo
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      if (!containerRef.current) return;

      // Verifica itens do clipboard para imagens
      const items = e.clipboardData?.items;
      let hasImage = false;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            hasImage = true;
            break;
          }
        }
      }

      if (hasImage && items) {
        e.preventDefault();
        const sel = window.getSelection();
        let range: Range | null = null;
        if (
          sel &&
          sel.rangeCount > 0 &&
          containerRef.current.contains(sel.getRangeAt(0).startContainer)
        ) {
          range = sel.getRangeAt(0);
        }

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const blob = item.getAsFile();
            if (blob) {
              const file = new File(
                [blob],
                blob.name || `screenshot-${Date.now()}.png`,
                { type: blob.type || "image/png" }
              );
              const mediaItem = createAttachedMediaItem(file);
              mediaMap.set(mediaItem.id, mediaItem);
              onMediaAdded?.(mediaItem);

              if (range) {
                insertChipAtRange(containerRef.current, range, mediaItem);
              } else {
                insertChipAtEnd(containerRef.current, mediaItem);
              }
            }
          }
        }
        handleContentChange();
        return;
      }

      // Se houver arquivos locais copiados
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        const sel = window.getSelection();
        let range: Range | null = null;
        if (
          sel &&
          sel.rangeCount > 0 &&
          containerRef.current.contains(sel.getRangeAt(0).startContainer)
        ) {
          range = sel.getRangeAt(0);
        }

        for (const file of Array.from(e.clipboardData.files)) {
          const mediaItem = createAttachedMediaItem(file);
          mediaMap.set(mediaItem.id, mediaItem);
          onMediaAdded?.(mediaItem);

          if (range) {
            insertChipAtRange(containerRef.current, range, mediaItem);
          } else {
            insertChipAtEnd(containerRef.current, mediaItem);
          }
        }
        handleContentChange();
        return;
      }

      // Paste de texto puro: insere sem carregar HTML ou estilos externos
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (text) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        handleContentChange();
      }
    };

    // Sincroniza estado de vazio na montagem
    useEffect(() => {
      if (containerRef.current) {
        const parsed = parseEditorDomToInterleaved(containerRef.current, mediaMap);
        setIsEmpty(parsed.plainText.length === 0 && parsed.insertedMediaIds.size === 0);
      }
    }, [mediaMap]);

    return (
      <div
        className={`relative w-full rounded-xl border transition-all text-sm leading-relaxed ${
          disabled
            ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed"
            : "bg-white dark:bg-[#0b0f19] border-slate-200 dark:border-slate-800 focus-within:border-brand-focus-border dark:focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-brand-focus-ring dark:focus-within:ring-slate-400 shadow-xs"
        } ${className}`}
      >
        {/* Placeholder visual */}
        {isEmpty && placeholder && (
          <div
            onClick={() => containerRef.current?.focus()}
            className="absolute top-3.5 left-3.5 right-3.5 text-slate-400 dark:text-slate-500 text-sm select-none pointer-events-none leading-relaxed"
          >
            {placeholder}
          </div>
        )}

        {/* Drop Cursor Visual Indicator */}
        {dropCursor && (
          <div
            className="pointer-events-none absolute z-30 transition-all duration-75 flex flex-col items-center"
            style={{
              top: `${dropCursor.top}px`,
              left: `${dropCursor.left - 1}px`,
              height: `${dropCursor.height}px`,
            }}
          >
            <div className="w-2 h-2 rounded-full bg-brand-action-indigo dark:bg-indigo-400 -mt-1 shadow-xs" />
            <div className="w-[2px] flex-1 bg-brand-action-indigo dark:bg-indigo-400 shadow-[0_0_8px_var(--brand-action-indigo)] dark:shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          </div>
        )}

        {/* Área Editável ContentEditable */}
        <div
          ref={containerRef}
          id={id}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onClick={handleClick}
          onInput={handleContentChange}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          style={{ minHeight }}
          className="p-3.5 outline-none text-slate-900 dark:text-white select-text break-words overflow-y-auto"
        />
      </div>
    );
  }
);
