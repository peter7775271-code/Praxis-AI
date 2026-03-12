"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import Filters, {
  AnimateChangeInHeight,
  createFilterId,
  Filter,
  FilterConfig,
  FilterOperator,
  FilterOption,
  FilterType,
} from "@/components/ui/filters";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  BookOpen,
  Brain,
  FileText,
  GraduationCap,
  ListFilter,
  LogOut,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import React, { Dispatch, SetStateAction, useRef, useState } from "react";

export function SidebarDemo() {
  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <GraduationCap className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Browse Bank",
      href: "/dashboard/browse",
      icon: <BookOpen className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Builder",
      href: "/dashboard/builder",
      icon: <FileText className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "AI Review",
      href: "/dashboard/analytics",
      icon: <Brain className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Sign out",
      href: "/login",
      icon: <LogOut className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
  ];

  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "mx-auto flex h-[70vh] w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-neutral-700 dark:bg-neutral-900 md:flex-row"
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link) => (
                <SidebarLink key={link.label} link={link} />
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: "Peter",
                href: "/dashboard/settings",
                icon: (
                  <Image
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43?auto=format&fit=crop&w=120&q=80"
                    className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                    width={50}
                    height={50}
                    alt="Profile avatar"
                  />
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <Dashboard />
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="/dashboard"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <Sparkles className="h-5 w-5 flex-shrink-0 text-amber-600" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="whitespace-pre font-medium text-black dark:text-white"
      >
        Praxis AI
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="/dashboard"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <Sparkles className="h-5 w-5 flex-shrink-0 text-amber-600" />
    </Link>
  );
};

const Dashboard = () => {
  return (
    <div className="flex flex-1 bg-[radial-gradient(circle_at_top_left,_rgba(147,197,253,0.18),_transparent_35%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(147,197,253,0.12),_transparent_35%),linear-gradient(180deg,_#171717_0%,_#0a0a0a_100%)]">
      <div className="flex h-full w-full flex-1 flex-col gap-6 rounded-tl-[2rem] border border-neutral-200 bg-white/90 p-4 backdrop-blur md:p-10 dark:border-neutral-700 dark:bg-neutral-900/90">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Reusable sidebar demo</p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Responsive navigation for the Praxis dashboard
          </h1>
          <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Desktop expands on hover. Mobile switches to a full-screen drawer. The links are pointed at existing dashboard sections so this can be reused as a shell component later.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            "HSC question coverage",
            "Saved attempts sync",
            "Formula revision kits",
            "AI marking latency",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200"
            >
              <div className="mb-3 h-2 w-16 rounded-full bg-amber-200 dark:bg-amber-500/40" />
              {item}
            </div>
          ))}
        </div>
        <div className="grid flex-1 gap-4 md:grid-cols-2">
          {[1, 2].map((column) => (
            <div
              key={column}
              className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-dashed border-neutral-300 bg-white/80 p-6 dark:border-neutral-700 dark:bg-neutral-950/60"
            >
              <div className="space-y-2">
                <div className="h-3 w-24 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3 w-40 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-3 w-32 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              </div>
              <div className="h-24 rounded-2xl bg-[linear-gradient(135deg,_rgba(251,191,36,0.18),_rgba(59,130,246,0.18))] dark:bg-[linear-gradient(135deg,_rgba(251,191,36,0.12),_rgba(59,130,246,0.12))]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

type ComboboxDemoProps = {
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  config: FilterConfig;
  filterGroups?: FilterOption[][];
  triggerLabel?: string;
  clearLabel?: string;
};

export function ComboboxDemo({
  filters,
  setFilters,
  config,
  filterGroups,
  triggerLabel = "Filter",
  clearLabel = "Clear",
}: ComboboxDemoProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedView, setSelectedView] = React.useState<FilterType | null>(null);
  const [commandInput, setCommandInput] = React.useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);

  const groups = React.useMemo<FilterOption[][]>(() => {
    if (filterGroups?.length) return filterGroups;

    return [
      Object.entries(config).map(([name, entry]) => ({
        name,
        icon: entry.icon,
      })),
    ];
  }, [config, filterGroups]);

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <Filters filters={filters} setFilters={setFilters} config={config} />
      {filters.filter((filter) => filter.value.length > 0).length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="transition group h-6 text-xs items-center rounded-sm"
          onClick={() => setFilters([])}
        >
          {clearLabel}
        </Button>
      )}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            window.setTimeout(() => {
              setSelectedView(null);
              setCommandInput("");
            }, 200);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            size="sm"
            className={cn(
              "transition group h-6 text-xs rounded-sm flex gap-1.5 items-center",
              filters.length > 0 && "w-6 px-0 justify-center"
            )}
          >
            <ListFilter className="size-3 shrink-0 transition-all text-muted-foreground group-hover:text-primary" />
            {!filters.length && triggerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0">
          <AnimateChangeInHeight>
            <Command>
              <CommandInput
                placeholder={selectedView ?? "Filter..."}
                className="h-9"
                value={commandInput}
                onValueChange={setCommandInput}
                ref={commandInputRef}
              />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                {selectedView ? (
                  <CommandGroup>
                    {config[selectedView].options.map((filter: FilterOption) => (
                      <CommandItem
                        className="group text-muted-foreground flex gap-2 items-center"
                        key={filter.name}
                        value={`${filter.name} ${filter.label ?? ""}`.trim()}
                        onSelect={() => {
                          const entry = config[selectedView];
                          setFilters((previousFilters) => {
                            const existing = previousFilters.find(
                              (candidate) => candidate.type === selectedView
                            );
                            const nextValues = existing
                              ? entry.allowMultiple
                                ? Array.from(new Set([...existing.value, filter.name]))
                                : [filter.name]
                              : [filter.name];
                            const nextOperator =
                              entry.allowMultiple && nextValues.length > 1
                                ? FilterOperator.IS_ANY_OF
                                : FilterOperator.IS;

                            if (existing) {
                              return previousFilters.map((candidate) =>
                                candidate.type === selectedView
                                  ? {
                                      ...candidate,
                                      operator: nextOperator,
                                      value: nextValues,
                                    }
                                  : candidate
                              );
                            }

                            return [
                              ...previousFilters,
                              {
                                id: createFilterId(),
                                type: selectedView,
                                operator: nextOperator,
                                value: nextValues,
                              },
                            ];
                          });
                          window.setTimeout(() => {
                            setSelectedView(null);
                            setCommandInput("");
                          }, 200);
                          setOpen(false);
                        }}
                      >
                        {filter.icon ?? config[selectedView].icon}
                        <span className="text-accent-foreground">
                          {filter.label ?? filter.name}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  groups.map((group: FilterOption[], index: number) => (
                    <React.Fragment key={index}>
                      <CommandGroup>
                        {group.map((filter: FilterOption) => (
                          <CommandItem
                            className="group text-muted-foreground flex gap-2 items-center"
                            key={filter.name}
                            value={filter.name}
                            onSelect={(currentValue) => {
                              setSelectedView(currentValue as FilterType);
                              setCommandInput("");
                              commandInputRef.current?.focus();
                            }}
                          >
                            {filter.icon}
                            <span className="text-accent-foreground">{filter.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {index < groups.length - 1 && <CommandSeparator />}
                    </React.Fragment>
                  ))
                )}
              </CommandList>
            </Command>
          </AnimateChangeInHeight>
        </PopoverContent>
      </Popover>
    </div>
  );
}