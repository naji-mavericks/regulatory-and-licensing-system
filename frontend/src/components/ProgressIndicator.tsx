interface Props {
  sections: { name: string; complete: boolean }[]
}

export default function ProgressIndicator({ sections }: Props) {
  const completeCount = sections.filter(s => s.complete).length

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">
          Progress: {completeCount}/{sections.length}
        </span>
        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(completeCount / sections.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <span
            key={s.name}
            className={`text-xs px-2 py-1 rounded ${
              s.complete
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {s.complete ? '✓' : '○'} {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
