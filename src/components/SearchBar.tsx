import { useState } from 'react';
import { useMiCa } from '../state/store';

export function SearchBar() {
  const { search, selectNode } = useMiCa();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(() => search(''));

  const handleChange = (value: string) => {
    setQuery(value);
    const next = search(value);
    setResults(next);
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Search nodes"
        className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-sand placeholder:text-slate-400 focus:border-aurora/60"
      />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-14 z-10 space-y-1 rounded-xl border border-white/10 bg-midnight/95 p-3 shadow-2xl">
          {results.map((result) => (
            <button
              key={result.id}
              className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm text-sand hover:bg-white/5"
              onClick={() => {
                selectNode(result.id);
                setResults([]);
              }}
            >
              <span className="font-semibold">{result.title}</span>
              <span className="text-xs text-slate-400">{result.snippet}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
