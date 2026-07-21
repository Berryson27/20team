import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

type PageHeadingProps = {
  eyebrow?: string
  title: string
  description: string
  backTo?: string
  action?: ReactNode
}

export function PageHeading({ eyebrow, title, description, backTo, action }: PageHeadingProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 sm:mb-7 md:mb-9">
      <div className="flex min-w-0 items-start gap-3">
        {backTo && (
          <Link
            to={backTo}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/80 bg-white/70 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground sm:mt-0.5 sm:size-10"
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <div>
          {eyebrow && <p className="mb-1.5 hidden text-xs font-bold uppercase tracking-[0.15em] text-primary sm:block">{eyebrow}</p>}
          <h1 className="text-xl font-extrabold tracking-[-0.045em] text-foreground sm:text-2xl md:text-3xl">{title}</h1>
          <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-muted-foreground sm:block md:text-base">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}
