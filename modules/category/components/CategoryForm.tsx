"use client";

import { useActionState, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { CategoryType } from "@prisma/client";
import { Tags } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategoryAction, updateCategoryAction } from "../actions";
import { CATEGORY_TYPES, formatCategoryType } from "../constants";
import type { CategoryActionState } from "../types";
import type { CategoryWithRelations } from "../repository";

const initialState: CategoryActionState = { success: false };

type CategoryFormProps = {
  mode: "create" | "edit";
  category?: CategoryWithRelations;
  trigger: ReactElement;
};

export default function CategoryForm({ mode, category, trigger }: CategoryFormProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const baseAction = mode === "create" ? createCategoryAction : updateCategoryAction;

  const [state, formAction, isPending] = useActionState(
    async (prevState: CategoryActionState, formData: FormData) => {
      const result = await baseAction(prevState, formData);
      if (result.success) {
        toast.success(mode === "create" ? "Category created successfully." : "Category updated successfully.");
        if (mode === "create") setFormKey((k) => k + 1);
        setOpen(false);
      } else if (result.message) {
        toast.error(result.message);
      }
      return result;
    },
    initialState,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && mode === "create") setFormKey((k) => k + 1);
        setOpen(isOpen);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent
        showCloseButton
        className="!w-[calc(100vw-1.5rem)] !max-w-[760px] max-h-[92vh] overflow-y-auto rounded-[26px] border border-[#30465D] bg-[#0E1925] p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:!w-[calc(100vw-3rem)]"
      >
        <div className="p-5 sm:p-7 md:p-8">
          <DialogHeader className="flex-row items-start gap-4 pr-10">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 sm:h-12 sm:w-12">
              <Tags size={22} />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-white sm:text-2xl">
                {mode === "create" ? "Add Category" : "Edit Category"}
              </DialogTitle>
              <DialogDescription className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500 sm:mt-2 sm:text-sm sm:leading-6">
                {mode === "create" ? "Create a new income or expense category." : "Update this category."}
              </DialogDescription>
            </div>
          </DialogHeader>

          <form
            key={formKey}
            action={formAction}
            className="mt-5 overflow-hidden rounded-[20px] border border-[#30465D] bg-[#0A1119] sm:mt-7 sm:rounded-[22px]"
          >
            {mode === "edit" && category && <input type="hidden" name="id" value={category.id} />}

            <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 md:p-7">
              <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={category?.name} placeholder="Food & Beverage" required className="border-[#30465D] bg-[#0A1119]" />
                  {state.fieldErrors?.name && <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type">Category Type</Label>
                  <Select name="type" defaultValue={category?.type ?? CategoryType.EXPENSE}>
                    <SelectTrigger id="type" className="w-full border-[#30465D] bg-[#0A1119]"><SelectValue placeholder="Select category type" /></SelectTrigger>
                    <SelectContent>{CATEGORY_TYPES.map((type) => <SelectItem key={type} value={type}>{formatCategoryType(type)}</SelectItem>)}</SelectContent>
                  </Select>
                  {state.fieldErrors?.type && <p className="text-xs text-destructive">{state.fieldErrors.type[0]}</p>}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                <div className="space-y-1.5">
                  <Label htmlFor="icon">Icon (optional)</Label>
                  <Input id="icon" name="icon" defaultValue={category?.icon ?? ""} placeholder="shopping-cart" className="border-[#30465D] bg-[#0A1119]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="color">Color (optional)</Label>
                  <Input id="color" name="color" defaultValue={category?.color ?? ""} placeholder="#3B82F6" className="border-[#30465D] bg-[#0A1119]" />
                </div>
              </div>

              {state.message && <p className="text-xs text-destructive">{state.message}</p>}
            </div>

            <DialogFooter className="border-t border-[#30465D] bg-[#0E1925] p-4 sm:p-5 md:p-6">
              <button
                type="button"
                onClick={() => { setFormKey((k) => k + 1); setOpen(false); }}
                disabled={isPending}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 hover:border-white/20 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-[#07110b] shadow-[0_10px_24px_rgba(16,185,129,0.12)] hover:bg-emerald-400 sm:px-6"
              >
                <Tags size={17} />
                {isPending ? "Saving..." : mode === "create" ? "Create Category" : "Save Changes"}
              </button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
