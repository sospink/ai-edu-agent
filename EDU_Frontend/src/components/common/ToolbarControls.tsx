import React from 'react';
import { Search } from 'lucide-react';
import { Select, SelectItem } from '@heroui/react';

interface ToolbarSearchFieldProps {
  value: string;
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}

interface ToolbarSelectOption {
  key: string;
  label: string;
  textValue?: string;
}

interface ToolbarSelectProps {
  ariaLabel: string;
  value: string;
  options: ToolbarSelectOption[];
  className?: string;
  placeholder?: string;
  isDisabled?: boolean;
  disallowEmptySelection?: boolean;
  onChange: (value: string) => void;
}

export const toolbarSelectClassNames = {
  base: 'w-full',
  trigger:
    'h-12 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(15,23,42,0.06)] transition data-[hover=true]:border-slate-300 data-[hover=true]:bg-white data-[focus=true]:border-primary-500 data-[focus=true]:bg-white data-[focus=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_12px_28px_rgba(59,130,246,0.12)]',
  innerWrapper: 'min-w-0 pr-7',
  value: 'truncate text-sm font-semibold text-slate-700 group-data-[has-value=false]:text-slate-400',
  selectorIcon: 'right-3 left-auto text-slate-400',
  popoverContent:
    'min-w-[220px] rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-2 shadow-[0_18px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl',
  listbox: 'gap-1 bg-transparent p-0',
};

export const toolbarSelectItemClassNames = {
  base: 'rounded-xl px-3 py-2 data-[hover=true]:bg-slate-100 data-[selectable=true]:focus:bg-slate-100',
  title: 'whitespace-nowrap text-sm font-medium text-slate-700',
  selectedIcon: 'text-primary-600',
};

export const ToolbarSearchField: React.FC<ToolbarSearchFieldProps> = ({ value, placeholder, className, onChange, onEnter }) => (
  <div className={className}>
    <div className="group relative h-12 overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(15,23,42,0.06)] transition focus-within:border-primary-500 focus-within:bg-white focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_12px_28px_rgba(59,130,246,0.12)] hover:border-slate-300 hover:bg-white">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-primary-500" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onEnter?.();
        }}
        placeholder={placeholder}
        className="h-full w-full bg-transparent pl-11 pr-4 text-sm font-semibold text-slate-700 placeholder:truncate placeholder:font-medium placeholder:text-slate-400 focus:outline-none"
      />
    </div>
  </div>
);

export const ToolbarSelect: React.FC<ToolbarSelectProps> = ({
  ariaLabel,
  value,
  options,
  className,
  placeholder,
  isDisabled = false,
  disallowEmptySelection = true,
  onChange,
}) => (
  <div className={className}>
    <Select
      aria-label={ariaLabel}
      placeholder={placeholder}
      selectedKeys={value ? [value] : []}
      onSelectionChange={(keys) => {
        const selected = Array.from(keys)[0];
        onChange(typeof selected === 'string' ? selected : '');
      }}
      size="md"
      variant="bordered"
      isDisabled={isDisabled}
      disallowEmptySelection={disallowEmptySelection}
      classNames={toolbarSelectClassNames}
      listboxProps={{ itemClasses: toolbarSelectItemClassNames }}
    >
      {options.map((option) => (
        <SelectItem key={option.key} textValue={option.textValue || option.label}>
          {option.label}
        </SelectItem>
      ))}
    </Select>
  </div>
);
