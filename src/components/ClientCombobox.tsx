import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { Building2, ChevronDown, Check, X } from "lucide-react";
import type { ClientItem } from "../services/api";

export interface ClientComboboxProps {
  clients: ClientItem[];
  selectedClient: ClientItem | null;
  onSelectClient: (client: ClientItem | null) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

/**
 * Normaliza strings para busca insensível a maiúsculas/minúsculas e tolerante a acentos.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra clientes com busca em tempo real por substring e normalização de caracteres acentuados.
 */
export function filterClients(clients: ClientItem[], query: string): ClientItem[] {
  if (!Array.isArray(clients)) return [];
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return clients;
  return clients.filter((client) =>
    normalizeText(client.name).includes(normalizedQuery)
  );
}

/**
 * Calcula o próximo índice destacado com suporte a ciclo circular (wrap around).
 */
export function getNextHighlightedIndex(
  currentIndex: number,
  delta: 1 | -1,
  totalItems: number
): number {
  if (totalItems <= 0) return -1;
  if (currentIndex === -1) {
    return delta === 1 ? 0 : totalItems - 1;
  }
  const next = currentIndex + delta;
  if (next < 0) return totalItems - 1;
  if (next >= totalItems) return 0;
  return next;
}

export function ClientCombobox({
  clients = [],
  selectedClient,
  onSelectClient,
  disabled = false,
  error,
  placeholder = "Buscar ou selecionar cliente...",
  required = false,
  id = "client-combobox",
}: ClientComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(selectedClient?.name || "");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const isUserTypingRef = useRef(false);

  // Sincroniza o input com alterações externas do cliente selecionado (ex: reset do form)
  useEffect(() => {
    if (isUserTypingRef.current) {
      isUserTypingRef.current = false;
      return;
    }
    if (selectedClient) {
      setSearchQuery(selectedClient.name);
    } else {
      setSearchQuery("");
    }
  }, [selectedClient]);

  // Lista de clientes filtrados em tempo real
  const filteredClients = useMemo(() => {
    return filterClients(clients, searchQuery);
  }, [clients, searchQuery]);

  // Garante que o item destacado permaneça dentro dos limites válidos
  useEffect(() => {
    if (highlightedIndex >= filteredClients.length) {
      setHighlightedIndex(filteredClients.length > 0 ? 0 : -1);
    }
  }, [filteredClients.length, highlightedIndex]);

  // Rola o item em destaque para a área visível do dropdown
  const scrollItemIntoView = useCallback((index: number) => {
    if (!listboxRef.current) return;
    const items = listboxRef.current.children;
    if (items && items[index]) {
      (items[index] as HTMLElement).scrollIntoView({
        block: "nearest",
      });
    }
  }, []);

  // Fechamento automático ao clicar fora do componente
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        isUserTypingRef.current = false;
        setIsOpen(false);
        setHighlightedIndex(-1);
        // Se fechou sem selecionar, reverte o texto para o cliente atualmente selecionado (ou limpa)
        if (selectedClient) {
          setSearchQuery(selectedClient.name);
        } else {
          setSearchQuery("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedClient]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    isUserTypingRef.current = true;
    setSearchQuery(value);
    setIsOpen(true);
    setHighlightedIndex(0);

    // Se o usuário alterou o texto e não coincide mais com o selecionado, desfaz a seleção
    if (selectedClient && selectedClient.name !== value) {
      onSelectClient(null);
    }
  };

  const handleSelect = (client: ClientItem) => {
    isUserTypingRef.current = false;
    onSelectClient(client);
    setSearchQuery(client.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    isUserTypingRef.current = false;
    onSelectClient(null);
    setSearchQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      setIsOpen(true);
      inputRef.current?.focus();
      setHighlightedIndex(filteredClients.length > 0 ? 0 : -1);
    } else {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(0);
        } else {
          const nextIndex = getNextHighlightedIndex(
            highlightedIndex,
            1,
            filteredClients.length
          );
          setHighlightedIndex(nextIndex);
          scrollItemIntoView(nextIndex);
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(filteredClients.length - 1);
        } else {
          const prevIndex = getNextHighlightedIndex(
            highlightedIndex,
            -1,
            filteredClients.length
          );
          setHighlightedIndex(prevIndex);
          scrollItemIntoView(prevIndex);
        }
        break;
      }
      case "Enter": {
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
          e.preventDefault();
          handleSelect(filteredClients[highlightedIndex]);
        }
        break;
      }
      case "Escape": {
        if (isOpen) {
          e.preventDefault();
          isUserTypingRef.current = false;
          setIsOpen(false);
          setHighlightedIndex(-1);
          setSearchQuery(selectedClient?.name || "");
        }
        break;
      }
      case "Tab": {
        if (isOpen) {
          isUserTypingRef.current = false;
          setIsOpen(false);
          setHighlightedIndex(-1);
          setSearchQuery(selectedClient?.name || "");
        }
        break;
      }
    }
  };

  const hasSelectionOrSearch = Boolean(selectedClient || searchQuery);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        {/* Leading icon */}
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-haspopup="listbox"
          aria-activedescendant={
            isOpen && highlightedIndex >= 0 && filteredClients[highlightedIndex]
              ? `${id}-option-${filteredClients[highlightedIndex].id}`
              : undefined
          }
          required={required && !selectedClient}
          disabled={disabled}
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`w-full bg-white dark:bg-[#0b0f19] border ${
            error
              ? "border-rose-500 dark:border-rose-500 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:focus:ring-rose-500"
              : "border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400"
          } text-slate-900 dark:text-white rounded-xl pl-10 pr-16 py-2.5 text-sm transition-all shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-900/50 disabled:cursor-not-allowed`}
        />

        {/* Trailing actions */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {hasSelectionOrSearch && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Limpar seleção"
              aria-label="Limpar seleção"
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleOpen}
            disabled={disabled}
            tabIndex={-1}
            title={isOpen ? "Fechar lista de clientes" : "Abrir lista de clientes"}
            aria-label={isOpen ? "Fechar lista de clientes" : "Abrir lista de clientes"}
            className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors disabled:cursor-not-allowed"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <p className="text-xs text-rose-500 mt-1 font-medium">{error}</p>
      )}

      {/* Dropdown de Clientes */}
      {isOpen && !disabled && (
        <ul
          ref={listboxRef}
          id={`${id}-listbox`}
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-1.5 w-full bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {filteredClients.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-slate-500 dark:text-slate-400 text-center select-none">
              Nenhum cliente encontrado
            </li>
          ) : (
            filteredClients.map((client, index) => {
              const isSelected = selectedClient?.id === client.id;
              const isHighlighted = highlightedIndex === index;

              return (
                <li
                  key={client.id}
                  id={`${id}-option-${client.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    // Previne perda de foco prematura antes de executar a seleção
                    e.preventDefault();
                    handleSelect(client);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3.5 py-2.5 text-sm flex items-center justify-between cursor-pointer transition-colors ${
                    isHighlighted
                      ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white"
                      : isSelected
                      ? "bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-medium"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="truncate">{client.name}</span>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default ClientCombobox;
