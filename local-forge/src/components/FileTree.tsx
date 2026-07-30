import type { FileNode } from '../lib/api.ts'

interface Props {
  tree: FileNode[]
  activePath?: string
  onOpen: (path: string) => void
}

function Node({
  node,
  depth,
  activePath,
  onOpen,
}: {
  node: FileNode
  depth: number
  activePath?: string
  onOpen: (path: string) => void
}) {
  if (node.type === 'dir') {
    return (
      <div>
        <div className="tree-item dir" style={{ paddingLeft: 8 + depth * 10 }}>
          <span>▸</span>
          <span>{node.name}</span>
        </div>
        <div className="tree-children">
          {(node.children ?? []).map((child) => (
            <Node
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`tree-item ${activePath === node.path ? 'active' : ''}`}
      style={{ paddingLeft: 8 + depth * 10 }}
      onClick={() => onOpen(node.path)}
    >
      <span>·</span>
      <span>{node.name}</span>
    </button>
  )
}

export function FileTree({ tree, activePath, onOpen }: Props) {
  return (
    <div className="file-tree">
      {tree.length === 0 ? (
        <p className="hint" style={{ padding: 8 }}>
          Empty workspace
        </p>
      ) : (
        tree.map((n) => (
          <Node key={n.path} node={n} depth={0} activePath={activePath} onOpen={onOpen} />
        ))
      )}
    </div>
  )
}
