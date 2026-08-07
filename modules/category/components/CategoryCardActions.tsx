"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

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

import { deleteCategoryAction } from "../actions";
import type { CategoryActionState } from "../types";
import type { CategoryWithRelations } from "../repository";

import CategoryForm from "./CategoryForm";

const initialState: CategoryActionState = {
  success: false,
};

type CategoryCardActionsProps = {
  category: CategoryWithRelations;
};

export default function CategoryCardActions({
  category,
}: CategoryCardActionsProps) {
  const [state, formAction, isPending] = useActionState(
    async (
      prevState: CategoryActionState,
      formData: FormData
    ) => {
      const result = await deleteCategoryAction(
        prevState,
        formData
      );

      if (result.success) {
        toast.success("Category deleted successfully.");
      } else if (result.message) {
        toast.error(result.message);
      }

      return result;
    },
    initialState
  );

  return (
    <div className="flex items-center gap-1">
      <CategoryForm
        mode="edit"
        category={category}
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${category.name}`}
          >
            <Pencil />
          </Button>
        }
      />

      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${category.name}`}
            >
              <Trash2 />
            </Button>
          }
        />

        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete category?
            </DialogTitle>

            <DialogDescription>
              {`"${category.name}" will be archived and hidden from your category list.`}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction}>
            <input
              type="hidden"
              name="id"
              value={category.id}
            />

            {state.message && (
              <p className="mb-2 text-xs text-destructive">
                {state.message}
              </p>
            )}

            <DialogFooter showCloseButton>
              <Button
                type="submit"
                variant="destructive"
                disabled={isPending}
              >
                {isPending
                  ? "Deleting..."
                  : "Delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}