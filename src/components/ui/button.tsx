import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const buttonVariants = cva(
    // Base — pill, inter tight, transitions matching the minimal template
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-[-0.01em] ring-offset-background " +
    "transition-[background,color,border-color,transform,box-shadow,padding,letter-spacing] duration-[250ms] " +
    "ease-[cubic-bezier(.2,.7,.2,1)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "hover:-translate-y-px hover:scale-[1.04] hover:tracking-[0.005em] active:translate-y-0 active:scale-100",
    {
        variants: {
            variant: {
                default:
                    "bg-capsula-navy-deep text-capsula-ivory hover:shadow-cap-deep",
                primary:
                    "bg-capsula-navy-deep text-capsula-ivory hover:shadow-cap-deep",
                destructive:
                    "bg-capsula-coral text-white hover:shadow-cap-deep",
                outline:
                    "border border-capsula-line-strong bg-transparent text-capsula-ink hover:border-capsula-navy-deep hover:bg-capsula-ivory-surface hover:shadow-cap-raised",
                secondary:
                    "bg-capsula-ivory-alt text-capsula-ink hover:bg-capsula-navy-soft hover:shadow-cap-raised",
                ghost:
                    "bg-transparent text-capsula-ink hover:bg-capsula-ivory-alt",
                link:
                    "text-capsula-ink underline-offset-4 hover:underline hover:scale-100 hover:translate-y-0",
                pill:
                    "bg-capsula-navy-soft text-capsula-ink hover:bg-capsula-navy-deep hover:text-capsula-ivory",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-9 px-3.5 text-xs",
                lg: "h-11 px-7 text-[15px]",
                xl: "h-12 px-8 text-base",
                icon: "h-10 w-10 p-0",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
    isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
