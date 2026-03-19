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
    editor.addCommand(
      2048 | 49, // CtrlCmd + S
      async () => {
        const value = editor.getValue()
        await window.api.writeFile(filePath, value)
        setSavedContent(value)
        dispatch({ type: 'SET_TAB_DIRTY', tabId, isDirty: false })
      }
    )
  }

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      dispatch({ type: 'SET_TAB_DIRTY', tabId, isDirty: value !== savedContent })
    }
  }

  if (content === null) return null

  return (
    <div style={{ width: '100%', height: '100%', display: visible ? 'block' : 'none' }}>
      <Editor
        defaultValue={content}
        language={getLanguage(filePath)}
        theme="vs-dark"
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
    </div>
  )
}
