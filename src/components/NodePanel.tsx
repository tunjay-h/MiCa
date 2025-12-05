import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { useMiCa } from '../state/store';
import { type ContentBlock, type NodeRecord } from '../state/types';
import { ResilientImage } from './ResilientImage';

const isAllowedEmbed = (url: string): boolean => {
  const host = new URL(url).hostname.replace('www.', '');
  return ['youtube.com', 'youtu.be', 'vimeo.com', 'figma.com'].some((domain) => host.endsWith(domain));
};

const EmbedBlock = ({ url }: { url: string }) => {
  if (!isAllowedEmbed(url)) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
        <p className="font-semibold">Embed blocked</p>
        <p className="text-xs">Only YouTube, Vimeo, and Figma are allowed. Showing link instead.</p>
        <a className="text-aurora underline" href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      </div>
    );
  }
  return (
    <div className="aspect-video overflow-hidden rounded-lg border border-white/5 bg-black/40">
      <iframe
        src={url}
        title="Embedded content"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        className="h-full w-full"
        allowFullScreen
      />
    </div>
  );
};

const renderBlock = (block: ContentBlock) => {
  switch (block.type) {
    case 'markdown':
      return (
        <div className="prose prose-invert max-w-none prose-h1:text-sand prose-a:text-aurora">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {block.text}
          </ReactMarkdown>
        </div>
      );
    case 'image':
      return (
        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
          <ResilientImage src={block.url} alt={block.alt ?? 'Node asset'} className="w-full rounded" />
          <p className="text-xs text-slate-400 break-all">{block.url}</p>
        </div>
      );
    case 'link':
      return (
        <a
          className="inline-flex items-center gap-2 rounded-lg border border-aurora/30 px-3 py-2 text-aurora hover:border-aurora/60"
          href={block.url}
          target="_blank"
          rel="noreferrer"
        >
          <span aria-hidden>🔗</span>
          {block.label ?? block.url}
        </a>
      );
    case 'embed':
      return <EmbedBlock url={block.url} />;
    default:
      return null;
  }
};

const NodeMeta = ({ node }: { node: NodeRecord }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
    <span className="rounded-full bg-white/5 px-2 py-1">Importance {node.importance}/5</span>
    {node.tags.map((tag) => (
      <span key={tag} className="rounded-full bg-aurora/10 px-2 py-1 text-aurora">
        #{tag}
      </span>
    ))}
    <span className="rounded-full bg-white/5 px-2 py-1">
      Updated {new Date(node.updatedAt).toLocaleDateString()}
    </span>
  </div>
);

export function NodePanel() {
  const { nodes, selectedNodeId, createNode, deleteNode, selectNode } = useMiCa();
  const node = nodes.find((entry) => entry.id === selectedNodeId) ?? nodes[0];

  if (!node) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/5 p-6">
        <p className="text-slate-300">Select a node to inspect its content.</p>
      </div>
    );
  }

  return (
    <aside className="rounded-2xl border border-white/5 bg-white/5 p-6 shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Node</p>
          <h2 className="text-2xl font-semibold text-sand">{node.title}</h2>
        </div>
        <span className="text-2xl" aria-hidden>
          ✦
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            className="rounded-lg border border-aurora/40 px-3 py-2 text-aurora hover:border-aurora/60"
            onClick={() => createNode({ parentId: node.id, title: `${node.title} child` })}
          >
            + Add child
          </button>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sand hover:border-red-500/50 hover:text-red-200"
            onClick={() => deleteNode(node.id)}
          >
            Delete
          </button>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sand hover:border-aurora/60"
            onClick={() => selectNode(undefined)}
          >
            Clear selection
          </button>
        </div>
        <NodeMeta node={node} />
        <div className="h-px w-full bg-white/10" />
        <div className="space-y-6">
          {node.blocks.map((block) => (
            <section key={block.id} className="space-y-2">
              {renderBlock(block)}
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
