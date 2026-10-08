"use client"

import * as React from "react"
import { useActionState } from "react"
import { BanknoteIcon, BuildingIcon, CalendarIcon, CoinsIcon, FolderKanbanIcon, PencilIcon, PlusIcon, ReceiptTextIcon, StoreIcon, TagIcon, Trash2Icon } from "lucide-react"

import { useRunAction } from "@/components/finance/invoice-actions"
import { ChoiceField } from "@/components/forms/choice-field"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { deleteExpense, saveExpense } from "@/lib/actions/finance"
import { currencyItems, expenseCategoryLabels } from "@/lib/finance/constants"
import type { ExpenseDTO } from "@/lib/finance/types"

type Options = {
  clients: { id: string; name: string }[]
  projects: { id: string; name: string; clientId: string }[]
  defaultCurrency: string
  today: string
}

const categoryItems = Object.entries(expenseCategoryLabels).map(([value, label]) => ({ value, label }))

function ExpenseForm({ expense, options, onDone }: { expense?: ExpenseDTO; options: Options; onDone: () => void }) {
  const toast = useToast()
  const [state, action, pending] = useActionState(saveExpense, undefined)
  const errors = state?.fieldErrors
  const [spentOn, setSpentOn] = React.useState(expense?.spentOn ?? options.today)
  const [amount, setAmount] = React.useState(expense ? String(expense.amount) : "")
  const [currency, setCurrency] = React.useState(expense?.currency ?? options.defaultCurrency)
  const [category, setCategory] = React.useState<string>(expense?.category ?? "SOFTWARE")
  const [vendor, setVendor] = React.useState(expense?.vendor ?? "")
  const [description, setDescription] = React.useState(expense?.description ?? "")
  const [clientId, setClientId] = React.useState(expense?.client?.id ?? "none")
  const [projectId, setProjectId] = React.useState(expense?.project?.id ?? "none")
  const projects = clientId === "none" ? options.projects : options.projects.filter((p) => p.clientId === clientId)

  // Handle each successful result once (onDone and toast change identity on re-render).
  const handled = React.useRef<typeof state>(undefined)
  React.useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state
      toast.add({ type: "success", title: state.message ?? "Saved." })
      onDone()
    }
  }, [state, toast, onDone])

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {expense && <input type="hidden" name="expenseId" value={expense.id} />}
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <FormField label="What was it for?" icon={ReceiptTextIcon} hint="A short description, e.g. the subscription or contractor." name="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Figma subscription" maxLength={500} errors={errors?.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" icon={CoinsIcon} name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" errors={errors?.amount} />
        <ChoiceField label="Currency" icon={BanknoteIcon} name="currency" id="expense-currency" value={currency} onChange={setCurrency} items={currencyItems} />
        <FormField label="Date" icon={CalendarIcon} hint="When the money was spent." name="spentOn" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} errors={errors?.spentOn} />
        <ChoiceField label="Category" icon={TagIcon} hint="Groups expenses in the totals." name="category" id="expense-category" value={category} onChange={setCategory} items={categoryItems} />
        <FormField label="Vendor" icon={StoreIcon} optional hint="Who you paid." name="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={120} />
        <div />
        <ChoiceField
          label="Client" icon={BuildingIcon} optional hint="Link it to a client to see what work costs."
          name="clientId"
          id="expense-client"
          value={clientId}
          onChange={(v) => {
            setClientId(v)
            setProjectId("none")
          }}
          items={[{ value: "none", label: "Studio overhead" }, ...options.clients.map((c) => ({ value: c.id, label: c.name }))]}
          error={errors?.clientId?.[0]}
        />
        <ChoiceField
          label="Project" icon={FolderKanbanIcon} optional
          name="projectId"
          id="expense-project"
          value={projectId}
          onChange={setProjectId}
          items={[{ value: "none", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
          error={errors?.projectId?.[0]}
        />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function ExpenseDialog({ expense, options }: { expense?: ExpenseDTO; options: Options }) {
  const [open, setOpen] = React.useState(false)
  const [key, setKey] = React.useState(0)
  const close = React.useCallback(() => setOpen(false), [])
  return (
    <>
      {expense ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${expense.description}`}
          onClick={() => {
            setKey((k) => k + 1)
            setOpen(true)
          }}
        >
          <PencilIcon />
        </Button>
      ) : (
        <Button
          onClick={() => {
            setKey((k) => k + 1)
            setOpen(true)
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Add expense
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription>Link it to a client or project to see what work really costs.</DialogDescription>
          </DialogHeader>
          <ExpenseForm key={key} expense={expense} options={options} onDone={close} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function DeleteExpenseButton({ expenseId, label }: { expenseId: string; label: string }) {
  const { run, pending } = useRunAction()
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${label}`} disabled={pending} className="text-muted-foreground hover:text-primary-strong" onClick={() => setOpen(true)}>
        <Trash2Icon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false)
                run(() => deleteExpense(expenseId), "Couldn't delete expense")
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { DeleteExpenseButton, ExpenseDialog }
