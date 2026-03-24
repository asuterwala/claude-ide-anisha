import { useEffect, useState, useRef, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useAppState } from '../store'

interface Props {
  tabId: string
  filePath: string
  visible: boolean
}

const extensionToLanguage: Record<string, string> = {
  rb: 'ruby',
  erb: 'html',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'html',
  css: 'css',
  scss: 'scss',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  md: 'markdown',
  sql: 'sql',
  sh: 'shell',
  zsh: 'shell',
  py: 'python',
  rake: 'ruby',
  gemspec: 'ruby',
  ru: 'ruby',
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (filePath.endsWith('Gemfile') || filePath.endsWith('Rakefile')) return 'ruby'
  return extensionToLanguage[ext] || 'plaintext'
}

export default function EditorTab({ tabId, filePath, visible }: Props) {
  const { dispatch } = useAppState()
  const [content, setContent] = useState<string | null>(null)
  const [savedContent, setSavedContent] = useState<string>('')
  const editorRef = useRef<any>(null)
  const [inlineEdit, setInlineEdit] = useState<{ top: number; left: number } | null>(null)
  const [inlinePrompt, setInlinePrompt] = useState('')
  const [inlineLoading, setInlineLoading] = useState(false)
  const inlineInputRef = useRef<HTMLInputElement>(null)

  const loadFile = useCallback(async () => {
    const text = await window.api.readFile(filePath)
    setContent(text)
    setSavedContent(text)
  }, [filePath])

  useEffect(() => {
    loadFile()
  }, [loadFile])

  useEffect(() => {
    const unsubscribe = window.api.onFileChange((changedPath) => {
      if (changedPath === filePath) {
        loadFile()
      }
    })
    return unsubscribe
  }, [filePath, loadFile])

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
    // Cmd+S to save
    editor.addCommand(
      2048 | 49, // CtrlCmd + S
      async () => {
        const value = editor.getValue()
        await window.api.writeFile(filePath, value)
        setSavedContent(value)
        dispatch({ type: 'SET_TAB_DIRTY', tabId, isDirty: false })
        dispatch({ type: 'TRACK_FEATURE', feature: 'fileSave' })
      }
    )

    // Cmd+K to trigger inline edit
    editor.addCommand(
      2048 | 41, // CtrlCmd + K
      () => {
        const selection = editor.getSelection()
        if (!selection || selection.isEmpty()) return

        // Get the position of the selection end to place the input
        const coords = editor.getScrolledVisiblePosition(selection.getEndPosition())
        if (!coords) return

        const editorDom = editor.getDomNode()
        if (!editorDom) return
        const rect = editorDom.getBoundingClientRect()

        setInlineEdit({
          top: rect.top + coords.top + coords.height + 4,
          left: rect.left + coords.left,
        })
        setInlinePrompt('')
        dispatch({ type: 'TRACK_FEATURE', feature: 'inlineEdit' })
        setTimeout(() => inlineInputRef.current?.focus(), 50)
      }
    )
  }

  const handleInlineSubmit = async () => {
    const editor = editorRef.current
    if (!editor || !inlinePrompt.trim()) return

    const selection = editor.getSelection()
    if (!selection) return

    const selectedText = editor.getModel()?.getValueInRange(selection)
    if (!selectedText) return

    setInlineLoading(true)
    try {
      const result = await window.api.inlineEdit(selectedText, inlinePrompt, filePath)
      // Replace the selection with Claude's output
      editor.executeEdits('inline-edit', [{
        range: selection,
        text: result,
      }])
      dispatch({ type: 'SET_TAB_DIRTY', tabId, isDirty: true })
    } catch (err) {
      console.error('[InlineEdit] Error:', err)
    } finally {
      setInlineLoading(false)
      setInlineEdit(null)
      setInlinePrompt('')
      editor.focus()
    }
  }

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInlineSubmit()
    }
    if (e.key === 'Escape') {
      setInlineEdit(null)
      setInlinePrompt('')
      editorRef.current?.focus()
    }
  }

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      dispatch({ type: 'SET_TAB_DIRTY', tabId, isDirty: value !== savedContent })
    }
  }

  if (content === null) return null

  return (
    <div style={{ width: '100%', height: '100%', display: visible ? 'block' : 'none', position: 'relative' }}>
      <Editor
        defaultValue={content}
        language={getLanguage(filePath)}
        theme="vs"
        onMount={handleEditorMount}
        onChange={handleChange}
        options={{
          minimap: { enabled: true, scale: 2 },
          fontFamily: "'SF Mono', Menlo, Consolas, monospace",
          fontSize: 13,
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
        }}
      />
      {/* Cmd+K inline edit input */}
      {inlineEdit && (
        <div
          style={{
            position: 'fixed',
            top: inlineEdit.top,
            left: inlineEdit.left,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#252526',
            border: '1px solid #4fc1ff',
            borderRadius: 6,
            padding: '6px 10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            minWidth: 320,
          }}
        >
          <span style={{ color: '#4fc1ff', fontSize: 12, fontWeight: 'bold', flexShrink: 0 }}>
            {inlineLoading ? '⏳' : '⌘K'}
          </span>
          <input
            ref={inlineInputRef}
            value={inlinePrompt}
            onChange={e => setInlinePrompt(e.target.value)}
            onKeyDown={handleInlineKeyDown}
            disabled={inlineLoading}
            placeholder={inlineLoading ? 'Claude is editing...' : 'Tell Claude what to do with this code...'}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 13,
              outline: 'none',
              fontFamily: "'SF Mono', Menlo, Consolas, monospace",
            }}
          />
          {!inlineLoading && (
            <span
              onClick={() => { setInlineEdit(null); setInlinePrompt(''); editorRef.current?.focus() }}
              style={{ color: '#666', cursor: 'pointer', fontSize: 14 }}
            >
              ×
            </span>
          )}
        </div>
      )}
    </div>
  )
}
