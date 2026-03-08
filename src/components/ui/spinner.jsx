import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({ className, size = 'md', ...props }) {
  // Map semantic sizes to numeric pixel values for SVG
  const sizeMap = { sm: 16, md: 20, lg: 24, xl: 32 };
  const iconSize = typeof size === 'string' ? sizeMap[size] || sizeMap.md : size;

  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn('animate-spin', className)}
      size={iconSize}
      {...props}
    />
  );
}

export { Spinner };
