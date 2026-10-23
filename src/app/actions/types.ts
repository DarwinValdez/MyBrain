export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Submitted values, echoed back so forms keep input after a validation error. */
  values?: Record<string, string>;
  data?: Record<string, string | number | null>;
};

export const initialActionState: ActionState = { ok: false };
