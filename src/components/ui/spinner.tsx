import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof sizeClasses
}

const Spinner = ({ className, size = "md", ...props }: SpinnerProps) => {
  return (
    <div className={cn("flex items-center justify-center", className)} {...props}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
    </div>
  )
}

export { Spinner }
