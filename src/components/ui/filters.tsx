'use client';

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, X } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AnimateChangeInHeightProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimateChangeInHeight: React.FC<AnimateChangeInHeightProps> = ({
  children,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const observedHeight = entries[0]?.contentRect.height;
      if (typeof observedHeight === 'number') {
        setHeight(observedHeight);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <motion.div
      className={cn(className, 'overflow-hidden')}
      style={{ height }}
      animate={{ height }}
      transition={{ duration: 0.12, damping: 20, ease: 'easeInOut' }}
    >
      <div ref={containerRef}>{children}</div>
    </motion.div>
  );
};

export enum FilterType {
  GRADE = 'Grade',
  YEAR = 'Year',
  SUBJECT = 'Subject',
  TOPIC = 'Topic',
  SCHOOL = 'School',
  QUESTION_TYPE = 'Question type',
  IMAGE_STATUS = 'Images',
}

export enum FilterOperator {
  IS = 'is',
  IS_ANY_OF = 'is any of',
}

export type FilterOption = {
  name: string;
  icon?: React.ReactNode;
  label?: string;
};

export type Filter = {
  id: string;
  type: FilterType;
  operator: FilterOperator;
  value: string[];
};

export type FilterConfigEntry = {
  icon?: React.ReactNode;
  options: FilterOption[];
  allowMultiple?: boolean;
  operators?: FilterOperator[];
};

export type FilterConfig = Record<FilterType, FilterConfigEntry>;

export const createFilterId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `filter-${Math.random().toString(36).slice(2, 10)}`;
};

const getOperators = (entry: FilterConfigEntry | undefined, selectedValues: string[]) => {
  if (!entry) return [FilterOperator.IS];
  if (entry.operators?.length) return entry.operators;
  if (entry.allowMultiple && selectedValues.length > 1) {
    return [FilterOperator.IS_ANY_OF, FilterOperator.IS];
  }
  return [FilterOperator.IS];
};

const FilterOperatorDropdown = ({
  filterType,
  operator,
  filterValues,
  config,
  setOperator,
}: {
  filterType: FilterType;
  operator: FilterOperator;
  filterValues: string[];
  config: FilterConfig;
  setOperator: (operator: FilterOperator) => void;
}) => {
  const operators = getOperators(config[filterType], filterValues);

  if (operators.length <= 1) {
    return (
      <div className='bg-muted px-1.5 py-1 text-muted-foreground shrink-0'>
        {operators[0]}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='bg-muted hover:bg-muted/70 px-1.5 py-1 text-muted-foreground hover:text-primary transition shrink-0'>
        {operator}
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-fit min-w-fit'>
        {operators.map((nextOperator) => (
          <DropdownMenuItem key={nextOperator} onClick={() => setOperator(nextOperator)}>
            {nextOperator}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const FilterValueCombobox = ({
  filterType,
  filterValues,
  config,
  setFilterValues,
}: {
  filterType: FilterType;
  filterValues: string[];
  config: FilterConfig;
  setFilterValues: (filterValues: string[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const entry = config[filterType];
  const optionMap = useMemo(
    () => new Map(entry.options.map((option) => [option.name, option])),
    [entry.options]
  );
  const selectedOptions = filterValues
    .map((value) => optionMap.get(value))
    .filter((option): option is FilterOption => Boolean(option));
  const remainingOptions = entry.options.filter((option) => !filterValues.includes(option.name));
  const displayLabel =
    selectedOptions.length === 1
      ? selectedOptions[0].label ?? selectedOptions[0].name
      : `${selectedOptions.length} selected`;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          window.setTimeout(() => setCommandInput(''), 200);
        }
      }}
    >
      <PopoverTrigger className='rounded-none px-1.5 py-1 bg-muted hover:bg-muted/70 transition text-muted-foreground hover:text-primary shrink-0'>
        <div className='flex gap-1.5 items-center'>
          <div className='flex items-center -space-x-1'>
            <AnimatePresence mode='popLayout'>
              {selectedOptions.slice(0, 3).map((option) => (
                <motion.div
                  key={option.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                >
                  {option.icon ?? entry.icon}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {displayLabel}
        </div>
      </PopoverTrigger>
      <PopoverContent className='w-[240px] p-0'>
        <AnimateChangeInHeight>
          <Command>
            <CommandInput
              placeholder={filterType}
              className='h-9'
              value={commandInput}
              onValueChange={setCommandInput}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {selectedOptions.length > 0 && (
                <CommandGroup>
                  {selectedOptions.map((option) => (
                    <CommandItem
                      key={option.name}
                      className='group flex gap-2 items-center'
                      onSelect={() => {
                        setFilterValues(filterValues.filter((value) => value !== option.name));
                        window.setTimeout(() => setCommandInput(''), 200);
                      }}
                    >
                      <Checkbox checked />
                      {option.icon ?? entry.icon}
                      {option.label ?? option.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {selectedOptions.length > 0 && remainingOptions.length > 0 && <CommandSeparator />}
              {remainingOptions.length > 0 && (
                <CommandGroup>
                  {remainingOptions.map((option) => (
                    <CommandItem
                      className='group flex gap-2 items-center'
                      key={option.name}
                      value={`${option.name} ${option.label ?? ''}`.trim()}
                      onSelect={() => {
                        const nextValues = entry.allowMultiple
                          ? [...filterValues, option.name]
                          : [option.name];
                        setFilterValues(nextValues);
                        window.setTimeout(() => setCommandInput(''), 200);
                        setOpen(false);
                      }}
                    >
                      <Checkbox
                        checked={false}
                        className='opacity-0 group-data-[selected=true]:opacity-100'
                      />
                      {option.icon ?? entry.icon}
                      <span className='text-accent-foreground'>
                        {option.label ?? option.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </AnimateChangeInHeight>
      </PopoverContent>
    </Popover>
  );
};

export default function Filters({
  filters,
  setFilters,
  config,
  className,
}: {
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  config: FilterConfig;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {filters
        .filter((filter) => filter.value.length > 0)
        .map((filter) => (
          <div key={filter.id} className='flex gap-[1px] items-center text-xs'>
            <div className='flex gap-1.5 shrink-0 rounded-l bg-muted px-1.5 py-1 items-center'>
              {config[filter.type]?.icon}
              {filter.type}
            </div>
            <FilterOperatorDropdown
              filterType={filter.type}
              operator={filter.operator}
              filterValues={filter.value}
              config={config}
              setOperator={(operator) => {
                setFilters((previousFilters) =>
                  previousFilters.map((candidate) =>
                    candidate.id === filter.id ? { ...candidate, operator } : candidate
                  )
                );
              }}
            />
            <FilterValueCombobox
              filterType={filter.type}
              filterValues={filter.value}
              config={config}
              setFilterValues={(filterValues) => {
                setFilters((previousFilters) =>
                  previousFilters.map((candidate) => {
                    if (candidate.id !== filter.id) {
                      return candidate;
                    }

                    const nextOperator = getOperators(config[filter.type], filterValues)[0] ?? FilterOperator.IS;
                    return {
                      ...candidate,
                      value: filterValues,
                      operator: nextOperator,
                    };
                  })
                );
              }}
            />
            <Button
              variant='ghost'
              size='icon'
              onClick={() => {
                setFilters((previousFilters) => previousFilters.filter((candidate) => candidate.id !== filter.id));
              }}
              className='bg-muted rounded-l-none rounded-r-sm h-6 w-6 text-muted-foreground hover:text-primary hover:bg-muted/70 transition shrink-0'
            >
              <X className='size-3' />
            </Button>
          </div>
        ))}
    </div>
  );
}