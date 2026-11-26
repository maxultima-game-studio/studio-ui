import type { InputHTMLAttributes } from "react";
import { X } from "lucide-react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

export function ClearableInput({
  value,
  onChange,
  className = "",
  ...rest
}: Props) {
  return (
    <div className="relative w-full">
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pr-8 ${className}`}
      />
      {value.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange("")}
          aria-label="Clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-200/80 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
