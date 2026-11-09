import type { CategoryOption } from '../lib/categories';
import { CheckCircleIcon } from './Icons';

type CategoryPickerProps = {
  options: CategoryOption[];
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
};

function CategoryIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

export function CategoryPicker({ options, value, loading, onChange }: CategoryPickerProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold text-ink-1">分类</legend>
      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-busy="true" aria-label="正在加载分类">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="nf-skeleton h-[62px] rounded-field border border-line" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {options.map((option) => {
            const selected = value === option.name;
            return (
              <div key={option.name} className="relative">
                <input
                  type="radio"
                  id={`category-${option.name}`}
                  name="category"
                  value={option.name}
                  checked={selected}
                  onChange={() => onChange(option.name)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`category-${option.name}`}
                  className={`flex h-full cursor-pointer flex-col justify-center gap-0.5 rounded-field border px-3 py-2.5 transition-[border-color,background-color,box-shadow] duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2 ${
                    selected
                      ? 'border-brand-600 bg-brand-50 shadow-[inset_0_0_0_1px_#3d5afe]'
                      : 'border-line bg-surface hover:border-line-strong hover:bg-surface-subtle'
                  }`}
                >
                  <span
                    className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${
                      selected ? 'text-brand-700' : 'text-ink-1'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center ${
                        selected ? 'text-brand-600' : 'text-ink-3'
                      }`}
                    >
                      <CategoryIcon path={option.icon} />
                    </span>
                    <span className="truncate">{option.label}</span>
                  </span>
                  <span
                    className={`hidden truncate pl-[22px] text-[11px] leading-4 sm:block ${selected ? 'text-brand-600/80' : 'text-ink-3'}`}
                  >
                    {option.description}
                  </span>
                </label>
                {selected && (
                  <CheckCircleIcon className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-brand-600" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
