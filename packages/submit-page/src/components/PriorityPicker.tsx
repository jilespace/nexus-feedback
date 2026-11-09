export type Priority = 'low' | 'medium' | 'high';

type PriorityPickerProps = {
  value: Priority;
  onChange: (value: Priority) => void;
};

const OPTIONS: Array<{ value: Priority; label: string; hint: string; dotClass: string }> = [
  { value: 'low', label: '低', hint: '不着急', dotClass: 'bg-ink-3' },
  { value: 'medium', label: '中', hint: '有影响', dotClass: 'bg-accent' },
  { value: 'high', label: '高', hint: '影响使用', dotClass: 'bg-danger-500' },
];

export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-center justify-between gap-3 text-[13px] font-semibold text-ink-1">
        优先级
        <span className="text-[11.5px] font-normal text-ink-3">影响范围与紧急程度</span>
      </legend>
      <div className="grid grid-cols-3 gap-1 rounded-field border border-line bg-surface-sunken p-1">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <div key={option.value}>
              <input
                type="radio"
                id={`priority-${option.value}`}
                name="priority"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={`priority-${option.value}`}
                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-[7px] px-2 py-1.5 text-[12.5px] font-semibold transition-[background-color,color,box-shadow] duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2 ${
                  selected
                    ? 'bg-surface text-ink-1 shadow-card'
                    : 'text-ink-3 hover:bg-surface/60 hover:text-ink-2'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${option.dotClass} ${selected ? 'opacity-100' : 'opacity-60'}`}
                  aria-hidden
                />
                {option.label}
                <span className={`text-[10.5px] font-normal ${selected ? 'text-ink-3' : 'text-ink-3/80'}`}>
                  {option.hint}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
