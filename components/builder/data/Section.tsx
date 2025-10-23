import React from "react"

type SectionProps = {
	id: string
	title: string
	children: React.ReactNode
	actions?: React.ReactNode
	expanded: { [k: string]: boolean }
	setExpanded: (fn: (s: { [k: string]: boolean }) => { [k: string]: boolean }) => void
}

export const Section: React.FC<SectionProps> = ({ id, title, children, actions, expanded, setExpanded }) => {
	const open = expanded[id]
	return (
		<div className="rounded border bg-background/50">
			<div className="flex items-center justify-between px-2 py-1.5 border-b">
				<button onClick={() => setExpanded(s => ({ ...s, [id]: !open }))} className="flex-1 flex items-center gap-2 text-left">
					<span className="text-xs font-semibold tracking-wide">{title}</span>
					<span className="ml-auto text-[10px] text-muted-foreground">{open ? '−' : '+'}</span>
				</button>
				{actions}
			</div>
			{open && <div className="p-2 space-y-2 text-xs">{children}</div>}
		</div>
	)
}
