export interface CreatePayeeInput {
  name: string;

  note?: string;
}

export interface UpdatePayeeInput {
  name?: string;

  note?: string;
}

export type PayeeActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};