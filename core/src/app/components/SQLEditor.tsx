"use client";

import { useEffect, useRef, useState } from "react";
import { init } from "modern-monaco";

/**
 * Example queries to help users get started.
 * These are static since they're documentation, not schema-derived.
 */
const EXAMPLE_QUERIES = [
  {
    name: "Recent Events",
    query: `SELECT event, page_url, created_at
FROM site_events
ORDER BY created_at DESC
LIMIT 50`,
  },
  {
    name: "Events by Type",
    query: `SELECT event, COUNT(*) as count
FROM site_events
GROUP BY event
ORDER BY count DESC`,
  },
  {
    name: "Find Unnamed Events",
    query: `SELECT event, COUNT(*) as count,
       datetime(MIN(created_at), 'unixepoch') as first_seen_utc,
       datetime(MAX(created_at), 'unixepoch') as last_seen_utc
FROM site_events
WHERE lower(event) LIKE '%unnamed%'
GROUP BY event
ORDER BY count DESC
LIMIT 100`,
  },
  {
    name: "Top Pages",
    query: `SELECT page_url, COUNT(*) as views
FROM site_events
WHERE event = 'pageview'
GROUP BY page_url
ORDER BY views DESC
LIMIT 20`,
  },
  {
    name: "Traffic by Country",
    query: `SELECT country, COUNT(*) as visits
FROM site_events
WHERE country IS NOT NULL
GROUP BY country
ORDER BY visits DESC
LIMIT 10`,
  },
  {
    name: "Device Breakdown",
    query: `SELECT device_type, COUNT(*) as count
FROM site_events
WHERE device_type IS NOT NULL
GROUP BY device_type`,
  },
  {
    name: "Browser Usage",
    query: `SELECT browser, COUNT(*) as count
FROM site_events
WHERE browser IS NOT NULL
GROUP BY browser
ORDER BY count DESC`,
  },
];

/** SQL keywords for autocomplete */
const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN",
  "IS", "NULL", "AS", "ORDER", "BY", "ASC", "DESC", "LIMIT", "OFFSET",
  "GROUP", "HAVING", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "UNION", "ALL",
  "CASE", "WHEN", "THEN", "ELSE", "END", "CAST", "COALESCE", "IFNULL",
  "STRFTIME", "DATE", "TIME", "DATETIME", "EXISTS", "WITH"
];

/** Column info returned from PRAGMA table_info */
interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
}

/** Index info returned from PRAGMA index_list + index_info */
interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

/** Table schema returned from the API */
interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

/** API response shape */
interface SchemaResponse {
  tables: TableSchema[];
  siteId: number | null;
  error?: string;
}

export interface SQLEditorProps {
  /** The SQL query value */
  value: string;
  /** Callback when the query changes */
  onChange?: (value: string) => void;
  /** Callback when user presses Ctrl+Enter to submit */
  onSubmit?: () => void;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Whether the editor is disabled/read-only */
  disabled?: boolean;
  /** Height of the editor (default: "200px") */
  height?: string;
  /** Monaco theme (default: "github-dark") */
  theme?: string;
  /** Additional class names for the container */
  className?: string;
  /** Whether to show schema tab (default: true) */
  showSchema?: boolean;
  /** Site ID to fetch schema for */
  siteId?: number | null;
}

/**
 * Schema viewer component showing table structure and example queries.
 * Fetches schema from the durable object at runtime.
 */
function SchemaViewer({ 
  onSelectQuery,
  height,
  siteId,
}: { 
  onSelectQuery?: (query: string) => void;
  height: string;
  siteId?: number | null;
}) {
  const [expandedSection, setExpandedSection] = useState<"columns" | "indexes" | "examples">("columns");
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setError("No site selected");
      return;
    }

    const fetchSchema = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/site-events/schema?site_id=${siteId}`);
        const data = await response.json() as SchemaResponse;
        
        if (!response.ok) {
          setError(data.error || "Failed to fetch schema");
          return;
        }

        if (data.tables && data.tables.length > 0) {
          setSchema(data.tables[0]);
        } else {
          setError("No tables found");
        }
      } catch (err) {
        setError("Failed to fetch schema");
        console.error("Schema fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [siteId]);

  if (loading) {
    return (
      <div 
        className="flex items-center justify-center bg-[var(--theme-input-bg)] rounded-lg border border-[var(--theme-input-border)]"
        style={{ height, minHeight: "120px" }}
      >
        <div className="text-sm text-[var(--theme-text-secondary)]">Loading schema...</div>
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div 
        className="overflow-y-auto bg-[var(--theme-input-bg)] rounded-lg border border-[var(--theme-input-border)]"
        style={{ height, minHeight: "120px" }}
      >
        {/* Show error but still allow access to examples */}
        <div className="p-3 border-b border-[var(--theme-input-border)]">
          {error && (
            <div className="text-xs text-amber-400 mb-2">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
              TABLE
            </span>
            <code className="text-sm font-semibold text-[var(--theme-text-primary)]">
              site_events
            </code>
          </div>
        </div>

        {/* Still show example queries */}
        <div className="p-3 space-y-3">
          <p className="text-xs text-[var(--theme-text-secondary)] mb-2">
            Example queries:
          </p>
          {EXAMPLE_QUERIES.map((example) => (
            <div key={example.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--theme-text-primary)]">
                  {example.name}
                </span>
                {onSelectQuery && (
                  <button
                    onClick={() => onSelectQuery(example.query)}
                    className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                  >
                    Use Query
                  </button>
                )}
              </div>
              <pre className="text-[11px] font-mono p-2 rounded bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)] overflow-x-auto whitespace-pre-wrap">
                {example.query}
              </pre>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="overflow-y-auto bg-[var(--theme-input-bg)] rounded-lg border border-[var(--theme-input-border)]"
      style={{ height, minHeight: "120px" }}
    >
      <div className="p-3 border-b border-[var(--theme-input-border)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
            TABLE
          </span>
          <code className="text-sm font-semibold text-[var(--theme-text-primary)]">
            {schema.name}
          </code>
        </div>
        <p className="text-xs text-[var(--theme-text-secondary)] mt-1">
          Stores all tracked events for a site
        </p>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-[var(--theme-input-border)]">
        {(["columns", "indexes", "examples"] as const).map((section) => (
          <button
            key={section}
            onClick={() => setExpandedSection(section)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              expandedSection === section
                ? "bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] border-b-2 border-blue-500"
                : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
            }`}
          >
            {section === "columns" && `Columns (${schema.columns.length})`}
            {section === "indexes" && `Indexes (${schema.indexes.length})`}
            {section === "examples" && `Examples (${EXAMPLE_QUERIES.length})`}
          </button>
        ))}
      </div>

      {/* Columns Section */}
      {expandedSection === "columns" && (
        <div className="divide-y divide-[var(--theme-input-border)]">
          {schema.columns.map((col) => (
            <div key={col.name} className="px-3 py-2 hover:bg-[var(--theme-bg-secondary)]">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono text-[var(--theme-text-primary)]">
                  {col.name}
                </code>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)]">
                  {col.type || "TEXT"}
                </span>
                {col.primaryKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                    PRIMARY KEY
                  </span>
                )}
                {!col.nullable && !col.primaryKey && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    NOT NULL
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Indexes Section */}
      {expandedSection === "indexes" && (
        <div className="p-3 space-y-2">
          <p className="text-xs text-[var(--theme-text-secondary)] mb-2">
            Indexed columns for optimized queries:
          </p>
          {schema.indexes.map((idx) => (
            <div 
              key={idx.name} 
              className="px-2 py-1.5 bg-[var(--theme-bg-secondary)] rounded text-xs font-mono text-[var(--theme-text-secondary)]"
            >
              <span className="text-[var(--theme-text-primary)]">{idx.name}</span>
              {" "}({idx.columns.join(", ")})
              {idx.unique && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                  UNIQUE
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Example Queries Section */}
      {expandedSection === "examples" && (
        <div className="p-3 space-y-3">
          {EXAMPLE_QUERIES.map((example) => (
            <div key={example.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--theme-text-primary)]">
                  {example.name}
                </span>
                {onSelectQuery && (
                  <button
                    onClick={() => onSelectQuery(example.query)}
                    className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                  >
                    Use Query
                  </button>
                )}
              </div>
              <pre className="text-[11px] font-mono p-2 rounded bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)] overflow-x-auto whitespace-pre-wrap">
                {example.query}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SQL Editor component using Monaco editor with SQL/SQLite syntax highlighting.
 * Includes a schema tab that fetches table structure from the durable object at runtime.
 * Provides autocomplete for table names, column names, and SQL keywords.
 * 
 * Autocomplete: Press Ctrl+Space (or Cmd+Space on Mac) to trigger suggestions.
 * 
 * Reusable across different parts of the application.
 */
export function SQLEditor({
  value,
  onChange,
  onSubmit,
  placeholder = "SELECT * FROM site_events LIMIT 10",
  disabled = false,
  height = "200px",
  theme = "github-dark",
  className = "",
  showSchema = true,
  siteId,
}: SQLEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completionProviderRef = useRef<any>(null);
  const isInitialized = useRef(false);
  const [activeTab, setActiveTab] = useState<"editor" | "schema">("editor");
  const [schema, setSchema] = useState<TableSchema | null>(null);
  // Keep schema in a ref so completion provider can access latest value
  const schemaRef = useRef<TableSchema | null>(null);
  schemaRef.current = schema;

  // Stable callbacks
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Fetch schema for autocomplete
  useEffect(() => {
    if (!siteId) return;

    const fetchSchema = async () => {
      try {
        const response = await fetch(`/api/site-events/schema?site_id=${siteId}`);
        const data = await response.json() as SchemaResponse;
        
        if (response.ok && data.tables && data.tables.length > 0) {
          setSchema(data.tables[0]);
        }
      } catch (err) {
        console.error("Failed to fetch schema for autocomplete:", err);
      }
    };

    fetchSchema();
  }, [siteId]);

  useEffect(() => {
    if (!containerRef.current || isInitialized.current) return;
    isInitialized.current = true;

    const initEditor = async () => {
      try {
        const monaco = await init({
          defaultTheme: theme,
          // Pre-load SQL grammar for syntax highlighting
          langs: ["sql"],
        });

        if (!containerRef.current) return;

        // Create a model with the SQL language explicitly set
        const model = monaco.editor.createModel(value, "sql");

        const editor = monaco.editor.create(containerRef.current, {
          model,
          theme: theme,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
          lineNumbers: "on",
          renderLineHighlight: "line",
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          readOnly: disabled,
          tabSize: 2,
          bracketPairColorization: { enabled: true },
          folding: true,
          glyphMargin: false,
          lineNumbersMinChars: 3,
          overviewRulerBorder: false,
          // Autocomplete settings - press Ctrl+Space to trigger suggestions
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          wordBasedSuggestions: "off",
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        });

        editorRef.current = editor;
        monacoRef.current = monaco;

        // Register completion provider
        registerCompletionProvider(monaco);

        // Listen for content changes
        editor.onDidChangeModelContent(() => {
          const newValue = editor.getValue();
          onChangeRef.current?.(newValue);
        });

        // Ctrl+Enter to submit query
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          onSubmitRef.current?.();
        });

        // Handle focus/blur for accessibility
        editor.onDidFocusEditorText(() => {
          containerRef.current?.classList.add("editor-focused");
        });

        editor.onDidBlurEditorText(() => {
          containerRef.current?.classList.remove("editor-focused");
        });
      } catch (error) {
        console.error("Failed to initialize Monaco editor:", error);
      }
    };

    initEditor();

    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
        completionProviderRef.current = null;
      }
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
      monacoRef.current = null;
      isInitialized.current = false;
    };
    // Only run once on mount - value updates handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper function to register completion provider
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registerCompletionProvider = (monaco: any) => {
    // Dispose previous provider if exists
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    // Register new completion provider
    completionProviderRef.current = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [" ", ".", ",", "("],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: Array<{
          label: string;
          kind: number;
          insertText: string;
          detail?: string;
          range: typeof range;
          sortText?: string;
        }> = [];

        // Add SQL keywords
        for (const keyword of SQL_KEYWORDS) {
          suggestions.push({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            detail: "SQL keyword",
            range,
            sortText: `2_${keyword}`, // Keywords sort after columns/tables
          });
        }

        // Add table name - use schemaRef to get latest value
        const currentSchema = schemaRef.current;
        if (currentSchema) {
          suggestions.push({
            label: currentSchema.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: currentSchema.name,
            detail: "Table",
            range,
            sortText: `0_${currentSchema.name}`, // Tables sort first
          });

          // Add column names
          for (const col of currentSchema.columns) {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col.name,
              detail: `${col.type || "TEXT"}${col.primaryKey ? " (PK)" : ""}${!col.nullable ? " NOT NULL" : ""}`,
              range,
              sortText: `1_${col.name}`, // Columns sort after tables, before keywords
            });
          }
        } else {
          // Fallback if schema not loaded - add site_events as table
          suggestions.push({
            label: "site_events",
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: "site_events",
            detail: "Table",
            range,
            sortText: "0_site_events",
          });
        }

        // Add common SQL functions
        const functions = [
          { name: "COUNT", detail: "Count rows" },
          { name: "SUM", detail: "Sum values" },
          { name: "AVG", detail: "Average value" },
          { name: "MIN", detail: "Minimum value" },
          { name: "MAX", detail: "Maximum value" },
          { name: "STRFTIME", detail: "Format date/time" },
          { name: "COALESCE", detail: "Return first non-null" },
          { name: "IFNULL", detail: "Replace null with value" },
          { name: "LENGTH", detail: "String length" },
          { name: "LOWER", detail: "Lowercase string" },
          { name: "UPPER", detail: "Uppercase string" },
          { name: "TRIM", detail: "Remove whitespace" },
          { name: "SUBSTR", detail: "Substring" },
          { name: "REPLACE", detail: "Replace text" },
          { name: "INSTR", detail: "Find position" },
          { name: "ABS", detail: "Absolute value" },
          { name: "ROUND", detail: "Round number" },
        ];

        for (const fn of functions) {
          suggestions.push({
            label: fn.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${fn.name}()`,
            detail: fn.detail,
            range,
            sortText: `3_${fn.name}`, // Functions sort after keywords
          });
        }

        return { suggestions };
      },
    });
  };

  // Update editor value when prop changes (from external source)
  useEffect(() => {
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== value) {
        editorRef.current.setValue(value);
      }
    }
  }, [value]);

  // Update read-only state when disabled changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: disabled });
    }
  }, [disabled]);

  // Update theme when it changes
  useEffect(() => {
    if (editorRef.current) {
      init().then((monaco) => {
        monaco.editor.setTheme(theme);
      });
    }
  }, [theme]);

  const handleSelectQuery = (query: string) => {
    if (editorRef.current) {
      editorRef.current.setValue(query);
      onChangeRef.current?.(query);
    }
    setActiveTab("editor");
  };

  // If schema is disabled, just render the editor
  if (!showSchema) {
    return (
      <div
        ref={containerRef}
        className={`sql-editor-container rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] overflow-hidden transition-all ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        } ${className}`}
        style={{ height, minHeight: "120px" }}
      />
    );
  }

  return (
    <div className={`sql-editor-wrapper ${className}`}>
      {/* Tabs */}
      <div className="flex mb-2 bg-[var(--theme-bg-secondary)] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("editor")}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === "editor"
              ? "bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] shadow-sm"
              : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
          }`}
        >
          Editor
        </button>
        <button
          onClick={() => setActiveTab("schema")}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === "schema"
              ? "bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] shadow-sm"
              : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
          }`}
        >
          Schema
        </button>
      </div>

      {/* Editor Tab */}
      <div style={{ display: activeTab === "editor" ? "block" : "none" }}>
        <div
          ref={containerRef}
          className={`sql-editor-container rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] overflow-hidden transition-all ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
          style={{ height, minHeight: "120px" }}
        />
        <p className="text-xs text-[var(--theme-text-secondary)] mt-1.5 opacity-70">
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--theme-bg-secondary)] font-mono text-[10px]">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-[var(--theme-bg-secondary)] font-mono text-[10px]">Space</kbd> autocomplete
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--theme-bg-secondary)] font-mono text-[10px]">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-[var(--theme-bg-secondary)] font-mono text-[10px]">Enter</kbd> run query
        </p>
      </div>

      {/* Schema Tab */}
      {activeTab === "schema" && (
        <SchemaViewer 
          onSelectQuery={handleSelectQuery} 
          height={height}
          siteId={siteId}
        />
      )}
    </div>
  );
}

export default SQLEditor;
