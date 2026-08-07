"use client";

import {
  useActionState,
  useState,
  type ReactElement,
} from "react";
import { toast } from "sonner";
import { CategoryType } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createCategoryAction,
  updateCategoryAction,
} from "../actions";

import {
  CATEGORY_TYPES,
  formatCategoryType,
} from "../constants";

import type {
  CategoryActionState,
} from "../types";

import type {
  CategoryWithRelations,
} from "../repository";

const initialState: CategoryActionState = {
  success: false,
};

type CategoryFormProps = {
  mode: "create" | "edit";
  category?: CategoryWithRelations;
  trigger: ReactElement;
};

export default function CategoryForm({
  mode,
  category,
  trigger,
}: CategoryFormProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const baseAction =
    mode === "create"
      ? createCategoryAction
      : updateCategoryAction;

  const [state, formAction, isPending] =
    useActionState(
      async (
        prevState: CategoryActionState,
        formData: FormData
      ) => {
        const result = await baseAction(
          prevState,
          formData
        );

        if (result.success) {
          toast.success(
            mode === "create"
              ? "Category created successfully."
              : "Category updated successfully."
          );

          if (mode === "create") {
            setFormKey((k) => k + 1);
          }

          setOpen(false);
        } else if (result.message) {
          toast.error(result.message);
        }

        return result;
      },
      initialState
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && mode === "create") {
          setFormKey((k) => k + 1);
        }

        setOpen(isOpen);
      }}
    >
      <DialogTrigger render={trigger} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Add Category"
              : "Edit Category"}
          </DialogTitle>

          <DialogDescription>
            {mode === "create"
              ? "Create a new income or expense category."
              : "Update this category."}
          </DialogDescription>
        </DialogHeader>
                <form
          key={formKey}
          action={formAction}
          className="space-y-4"
        >
          {mode === "edit" && category && (
            <input
              type="hidden"
              name="id"
              value={category.id}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">
              Name
            </Label>

            <Input
              id="name"
              name="name"
              defaultValue={category?.name}
              placeholder="Food & Beverage"
              required
            />

            {state.fieldErrors?.name && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">
              Category Type
            </Label>

            <Select
              name="type"
              defaultValue={
                category?.type ??
                CategoryType.EXPENSE
              }
            >
              <SelectTrigger
                id="type"
                className="w-full"
              >
                <SelectValue placeholder="Select category type" />
              </SelectTrigger>

              <SelectContent>
                {CATEGORY_TYPES.map((type) => (
                  <SelectItem
                    key={type}
                    value={type}
                  >
                    {formatCategoryType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {state.fieldErrors?.type && (
              <p className="text-xs text-destructive">
                {state.fieldErrors.type[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="icon">
              Icon (optional)
            </Label>

            <Input
              id="icon"
              name="icon"
              defaultValue={category?.icon ?? ""}
              placeholder="shopping-cart"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="color">
              Color (optional)
            </Label>

            <Input
              id="color"
              name="color"
              defaultValue={category?.color ?? ""}
              placeholder="#3B82F6"
            />
          </div>

          {state.message && (
            <p className="text-xs text-destructive">
              {state.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormKey((k) => k + 1);
                setOpen(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending
                ? "Saving..."
                : mode === "create"
                  ? "Create Category"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
              </DialogContent>
    </Dialog>
  );
}