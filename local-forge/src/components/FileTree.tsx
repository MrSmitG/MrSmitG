import { useMemo, useState } from 'react'
import type { FileNode } from '../lib/api.ts'

interface Props {
  tree: FileNode[]
  activePath?: string
  onOpen: (path: string) => void
  onCreate: () => void
  onDelete: (path: string) => void
}

function Node({
  node,
  depth,
  activePath,
  onOpen,
  onDelete,
}: {
  node: FileNode
  depth: number
  activePath?: string
  onOpen: (path: string) => void
  onDelete: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)

  if (node.type === 'dir') {
    return (
      <div>
        <button
          type="button"
          className="tree-item dir"
          style={{ paddingLeft: 8 + depth * 10 }}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{open ? '▾' : '▸'}</span>
          <span>{node.name}</span>
        </button>
        {open && (
          <div className="tree-children">
            {(node.children ?? []).map((child) => (
              <Node
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onOpen={onOpen}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="tree-row">
      <button
        type="button"
        className={`tree-item ${activePath === node.path ? 'active' : ''}`}
        style={{ paddingLeft: 8 + depth * 10 }}
        onClick={() => onOpen(node.path)}
      >
        <span>·</span>
        <span>{node.name}</span>
      </button>
      <button
        type="button"
        className="tree-del"
        title="Delete file"
        onClick={() => onDelete(node.path)}
      >
        ×
      </button>
    </div>
  )
}

export function FileTree({ tree, activePath, onOpen, onCreate, onDelete }: Props) {
  const count = useMemo(() => {
    const walk = (nodes: FileNode[]): number =>
      nodes.reduce((n, x) => n + (x.type === 'file' ? 1 : walk(x.children ?? [])), 0)
    return walk(tree)
  }, [tree])

  return (
    <div className="file-tree">
      <div className="tree-toolbar">
        <span className="hint">{count} files</span>
        <button type="button" className="ghost-btn" style={{ padding: '2px 8px' }} onClick={onCreate}>
          + file
        </button>
      </div>
      {tree.length === 0 ? (
        <p className="hint" style={{ padding: 8 }}>
          Empty workspace
        </p>
      ) : (
        tree.map((n) => (
          <Node
            key={n.path}
            node={n}
            depth={0}
            activePath={activePath}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  )
}
