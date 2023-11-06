"use server";

import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer.",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),
  date: z.string(),
});

const CreateInvoice = InvoiceSchema.omit({ id: true, date: true });
const UpdateInvoice = InvoiceSchema.omit({ date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(formData: FormData) {
  try {
    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = CreateInvoice.safeParse(rawFormData);
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: "Missing Fields. Failed to Create Invoice.",
      };
    }
    const { customerId, amount, status } = CreateInvoice.parse(rawFormData);
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split("T")[0];
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
  } catch (error) {
    return {
      message: "Database Error: Failed to Create Invoice.",
    } as any;
  }
}

export async function updateInvoice(id: string, formData: FormData) {
  try {
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get("customerId"),
      amount: formData.get("amount"),
      status: formData.get("status"),
    });

    const amountInCents = amount * 100;

    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;

    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
  } catch (error) {
    return { message: "Database Error: Failed to Update Invoice." };
  }
}

export async function deleteInvoice(id: string) {
  throw new Error("Failed to Delete Invoice");
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath("/dashboard/invoices");
  } catch (error) {
    return { message: "Database Error: Failed to Delete Invoice." };
  }
}
