import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'bg-primary/10 text-primary',
      danger: 'bg-danger/10 text-danger',
      warning: 'bg-warning/15 text-[#b96800]',
      outline: 'border border-border bg-white/70 text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
